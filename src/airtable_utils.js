const Apify = require('apify');

const { log } = Apify.utils;
const CONSTS = require('./consts');


exports.atblGetRows = async (airTbl, config) => {
    return new Promise((resolve, reject) => {
        let data = [];

        airTbl.select({ ...config }).eachPage(
            (records, fetchNextPage) => {
                data = [...data, ...records];
                fetchNextPage();
            },
            (err) => {
                if (err) {
                    log.error(`err [${err}]`);
                    return reject(err);
                }
                resolve(data.filter(rows => !!rows));
            },
        );
    });
};

exports.atblUpdtRow = async (airTbl, rowObj, primeKey, destructive) => {
    let success = true;
    let errObj = null;

    // first fetch Airtable row (by primaryKey) to retrieve the 'rowId'
    const config = {};
    config.filterByFormula = `${exports.formatColumnFilter(primeKey)} = ${rowObj[primeKey]}`;
    config.fields = [primeKey]; // return minimum data as we are only interested in rowId

    const targetRows = await exports.atblGetRows(airTbl, config);

    const numMatches = targetRows.length;
    if (numMatches === 0) {
        if (CONSTS.upsertIfNotExist) {
            return exports.atblInsertRow(airTbl, rowObj);
        }

        success = false;
        const errStr = 'doUpdateRow: The primary key did not match any rows and upsertIfNotExist is false';
        errObj = { str: errStr, code: 404 };

        log.debug(errStr);
    } else if (numMatches > 1) {
        success = false;
        const errStr = 'doUpdateRow: The primary key matched more than one row';
        errObj = { str: errStr, code: 409 };

        log.debug(errStr);
    } else {
        const rowId = targetRows[0].id;

        try {
            if (destructive) {
                await airTbl.replace(rowId, rowObj);
            } else {
                await airTbl.update(rowId, rowObj);
            }
        } catch (err) {
            success = false;

            const errStr = exports.formatError(err);
            errObj = { str: errStr, code: err.statusCode };

            log.debug(`atblUpdtRow: ${errStr}`);
        }
    }

    return { success, errObj };
};

exports.atblInsertRow = async (airTbl, rowObj) => {
    let success = true;
    let errObj = null;

    try {
        await airTbl.create(rowObj, { typecast: true });
    } catch (err) {
        success = false;

        const errStr = exports.formatError(err);
        errObj = { str: errStr, code: err.statusCode };
        log.debug(`atblInsertRow: ${errStr}`);
    }

    return { success, errObj };
};

exports.formatError = (err) => {
    let errStr = 'Error:';
    if (err.statusCode) errStr += ` [${err.statusCode}]`;
    if (err.error) errStr += ` [${err.error}]`;
    if (err.message) errStr += `: [${err.message}]`;

    return errStr;
};

exports.formatColumnFilter = (columnName = '') => {
    columnName = `${columnName}`;
    return columnName.split(' ').length > 1 ? `{${columnName}}` : columnName;
};
