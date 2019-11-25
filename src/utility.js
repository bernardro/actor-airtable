const moment = require('moment');
const hashfunc = require('object-hash');
const Apify = require('apify');

const { log, sleep } = Apify.utils;
const CONSTS = require('./consts');


exports.getSourceRecords = async (datasets, input) => {
    const { rawData } = input;

    if (exports.isEmptyObj(rawData)) {
        log.info('Fetching Apify records...');
        const { datasetId, fields, maxItems } = input;
        const dataSet = await datasets.getItems({
            datasetId,
            fields,
            limit: maxItems,
            clean: true,
        });

        log.info(`${dataSet.count}/${dataSet.total} items fetched from apify dataset`);
        return dataSet.items;
    }

    log.debug('rawData provided in INPUT - Apify records will not be fetched');
    return rawData;
};

exports.getHandledHashes = async (datasets, datasetId) => {
    const handledRowHashes = {};

    const hashTable = await datasets.getItems({ datasetId, clean: true });
    if (hashTable.total > CONSTS.maxDatasetFetchCount) {
        throw new Error(`getHandledHashes: cannot handle more than ${CONSTS.maxDatasetFetchCount} items (Apify default for limit of getItems())`);
    }

    if (hashTable.count > 0) {
        log.debug('continuing previous run where some records failed to export to Airtable');

        for (const hashObj of hashTable.items) {
            handledRowHashes[hashObj.hash] = hashObj.success;
        }
    }

    return handledRowHashes;
};

exports.getHashTable = async (datasets, token, clearExports) => {
    const hashTable = await datasets.getOrCreateDataset({
        token,
        datasetName: CONSTS.APIFY.EXPORT_HISTORY_DATASET,
    });

    if (clearExports && hashTable.itemCount > 0) {
        await exports.clearExportHistory(datasets, hashTable.id, token);

        return datasets.getOrCreateDataset({
            token,
            datasetName: CONSTS.APIFY.EXPORT_HISTORY_DATASET,
        });
    }

    return hashTable;
};

exports.getTableRow = (rec) => {
    const obj = {};

    // convert all values to strings to avoid
    // typecasting errors on the Airtable end
    Object.keys(rec).forEach((key) => {
        obj[key] = `${rec[key]}`;
    });

    const hash = hashfunc(obj);
    return { obj, hash };
};

exports.waitForNextApiWindow = async (then, minWaitMs) => {
    if (then) {
        const now = moment();
        const duration = moment.duration(now.diff(then));
        const timeSinceLastCallMs = duration.as('milliseconds');

        if (timeSinceLastCallMs < minWaitMs) {
            const requiredWaitMs = minWaitMs - timeSinceLastCallMs;

            log.debug(`waiting ${requiredWaitMs}ms for the next API window`);
            await sleep(requiredWaitMs);
        }
    }
};

exports.buildOutputReport = async (handledHashes, errorLog) => {
    const handledKeys = Object.keys(handledHashes);
    const successRows = handledKeys.filter(hash => handledHashes[hash]);
    const successCount = successRows.length;
    const failureCount = handledKeys.length - successCount;

    const reportObj = {
        successful: successCount,
        failed: failureCount,
        errors: errorLog,
    };

    log.debug(`${successCount}/${handledKeys.length} success/handled`);
    log.debug(`${failureCount}/${errorLog.length} failures/logged errors...`);

    await Apify.setValue('REPORT', reportObj);

    return failureCount === 0;
};

exports.clearExportHistory = async (datasets, datasetId, token) => {
    await datasets.deleteDataset({ datasetId, token });
};

exports.isRecoverableError = (statusCode) => {
    if (!statusCode) throw new Error('isRecoverableError: A status code must be provided');

    const statusNum = parseInt(`${statusCode}`, 10);
    return statusNum < 400;
};

exports.isEmptyObj = (obj) => {
    return Object.keys(obj).length === 0 && obj.constructor === Object;
};
