const moment = require('moment');
const Apify = require('apify');
const ApifyClient = require('apify-client');
const Airtable = require('airtable');

const { log } = Apify.utils;

const utils = require('./utility');
const atblUtils = require('./airtable_utils');
// const devUtils = require('./dev_utils');

const CONSTS = require('./consts');

const MIN_WAIT_MS = Math.ceil(1000 / CONSTS.AIRTBL.API_CALLS_PER_SEC);


Apify.main(async () => {
    const input = await Apify.getInput();

    if (input.verboseLog) {
        log.setLevel(log.LEVELS.DEBUG);
    } else {
        log.setLevel(log.LEVELS.WARNING);
    }

    // input validation
    const { fields, updateMode, primaryKey, destructiveUpdate } = input;
    if (updateMode) {
        if (primaryKey) {
            if (fields.indexOf(primaryKey) === -1) {
                throw new Error('to do update primaryKey must be one of the "fields" in INPUT');
            }
        } else {
            throw new Error('to do updates primaryKey must be specified in INPUT');
        }
    } else if (destructiveUpdate) {
        log.warning('inconsistent INPUT config: destructiveUpdate is true but updateMode is false');
    }

    const { APIFY_USER_ID, APIFY_TOKEN } = process.env;
    const apfyClient = await new ApifyClient({ APIFY_USER_ID, APIFY_TOKEN });

    const hashTable = await utils.getHashTable(apfyClient.datasets, APIFY_TOKEN, input.clearHistory);

    // check if there was a previous run and return list of attempted hashes
    const jsonItems = await utils.getSourceRecords(apfyClient.datasets, input);
    const handledHashes = await utils.getHandledHashes(apfyClient.datasets, hashTable.id);

    log.info('Connecting to Airtable...');
    Airtable.configure({
        endpointUrl: CONSTS.AIRTBL.ENDPOINT_URL,
        apiKey: input.apiKey,
    });

    const { baseId, tableName } = input;
    const airTbl = Airtable.base(baseId).table(tableName);

    log.info('Sending data to Airtable ...');
    const { destructiveUpdate: destruct } = input;
    const errLog = [];
    let prevCallTime = null;
    for (const rec of jsonItems) {
        // Airtable allows batching of multiple records in one
        // API call but we want to capture individual errors
        const row = utils.getTableRow(rec);

        const hasNotBeenAttempted = !(row.hash in handledHashes);
        const wasNotSuccessful = hasNotBeenAttempted ? true : !handledHashes[row.hash];

        // skip records that have been successfully exported
        if (hasNotBeenAttempted || wasNotSuccessful) {
            // do not exceed Airtable's imposed API limits
            await utils.waitForNextApiWindow(prevCallTime, MIN_WAIT_MS);
            let result = null;
            if (updateMode) {
                result = await atblUtils.atblUpdtRow(airTbl, row.obj, primaryKey, destruct);
            } else {
                result = await atblUtils.atblInsertRow(airTbl, row.obj);
            }
            prevCallTime = moment();

            // the result of the attempt
            const putOpts = {
                datasetId: hashTable.id,
                token: APIFY_TOKEN,
                data: { success: result.success, hash: row.hash },
            };
            await apfyClient.datasets.putItems(putOpts);

            // update runtime hashTable
            handledHashes[row.hash] = result.success;

            if (result.errObj) {
                const error = result.errObj;

                // keep a record of errors
                errLog.push({ error: error.str, rowHash: row.hash });

                // keep going if possible
                if (!utils.isRecoverableError(error.code)) {
                    log.debug('Unrecoverable Error; aborting...');
                    throw new Error(`[${error.code}]: ${error.str}`);
                }
            }
        }
    }

    log.info('Saving output report...');
    const noErrors = await utils.buildOutputReport(handledHashes, errLog);
    if (noErrors) {
        log.info('No errors during export, clearing export history');
        await utils.clearExportHistory(apfyClient.datasets, hashTable.id, APIFY_TOKEN);
    }
    log.info('>>> Actor run finished...');
});
