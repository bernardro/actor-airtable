exports.AIRTBL = {
    POST_BATCH_SIZE: 10,
    FETCH_BATCH_SIZE: 100,
    API_CALLS_PER_SEC: 5,
    ENDPOINT_URL: 'https://api.airtable.com',
};

exports.APIFY = {
    EXPORT_HISTORY_DATASET: 'EXPORT-HASHES',
};

exports.upsertIfNotExist = true;
exports.maxDatasetFetchCount = 100000;
