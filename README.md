![Apify Airtable Integration](https://user-images.githubusercontent.com/53663510/69981644-b9d2ba80-1500-11ea-9f85-2363a0a10a87.jpg "Apify Airtable Integration")

# Actor Airtable

Airtable is a user friendly online database management system.
Its main selling points are:
- Similarity to Microsoft Excel with a user friendly interface that hides complexity from users
- Ability to configure it for a large number of use-cases
- Large number of integrations with other popular business apps for importing/exporting data
- Support for common tasks such as collecting(via forms), grouping(e.g rollups) and presenting(views) data

This is an Apify actor that allows us to import and export data to and from Apify datasets.
This enables use to, for instance, scrape data and send it right into Airtable for further processing.

Airtable comes with some restrictions that will naturally also restrict the capability of this actor:
- All programmatic interraction with Airtable is via the user's API key
- The API is limited to 5 requests per second per base
- The API limits the number of records that can be sent in a single API call
- As of today (Nov 2019) Airtable API does not provide the ability to create tables or change the schema of existing tables

Because of the limitations mentioned above, the user will need to:
- Have an Airtable account and generate an API key for themselves (under **Settings**)
- Create at least one `base` - which is the equivalent of a database
- Create at least one `table` in that base where data from Apify will be sent
- Ensure that table has fields that match all the fields to be exported from Apify

For now this actor supports data import from Apify into Airtable; more features will be added as time goes.  

Features **not** available in this actor:
- Ability to export data out of Airtable into Apify

## Input parameters
The input of this actor should be JSON specifying what data to export from Apify and where to send it in Airtable.  
If this actor is run on the Apify platform a user friendly graphical interface will be provided for you to configure the actor before running it.  

This actor recognizes the following fields:  

| Field | Type | Description |  
| ----- | ---- | ----------- |  
| datasetId | String | (required) The Id of the source dataset in Apify |  
| fields | Array | (optional) The fields to be exported; lave blank to export all fields |  
| primaryKey | String | (optional) The name of the field to be used as the **Primary Key**; required for **update mode** |  
| maxItems | Integer | (optional) Maximum number of records to pull from Apify dataset; default is 100; to fetch all records leave blank |  
| tableName | String | (required) Name of the destination table in Airtable |    
| baseId | String | (required) The Airtable baseId |  
| apiKey | String | (required) The Airtable API Key |  
| updateMode | Boolean | (optional) Update mode - when true existing records are updated, when false new records are inserted; default is false |  
| clearHistory* | Boolean | (optional) Keep track of export statistics; when set to false only records that previously failed will be re-attempted in subsequent runs; default is true |  
| destructiveUpdate | Boolean | (optional) If a matching record is found during export the entire row is completely replaced; default is false i.e only update changed fields |  
| rawData | Object | (optional) JSON data to use as input instead of Apify records; if this value is specified Apify records will not be fetched |  
| verboseLog | Boolean | (optional) Turn on verbose logging; default is false |  
  

### \*Special notes on `clearHistory` input parameter 
Setting `clearHistory = false` will result in the actor using the previous run's log.
This allows us to process the data as follows:
 - go through the error logs (stored as **OUTPUT** in Apify's KeyValue store) to see what is causing records to be rejected by Airtable
 - clean the data and save the cleaned data in a new Apify dataset
 - run the actor again and supply the new `datasetId`; ths time only new records and records that had previously failed will be exported
 - check if there are any more errors and repeat the steps above until a satisfactory result is achieved

Please note that while `clearHistory = false` it is assumed that all runs are exporting to the same Airtable base and table. 
It is therefore recommended to only toggle it `true` if some records fail to export in the previous run; you can then go 
through the workflow outlined above until a satisfactory result is achieved.

This workflow can save time if, say, you have 1000 records to export of which only 10 fail.
 
When starting a new export project (different Airtable base or table) this option should always be `clearHistory = true`

Any time the actor run ends with no errors the history log is cleared automatically as there is no need to keep the log

### Airtable actor Input example  
```json
{
    "datasetId": "EsoelfJslsekADfde",
    "fields": ["Name", "Phone", "ZipCode"],
    "primaryKey": "Phone",
    "maxItems": 10,
    "tableName": "Customers",
    "baseId": "appWtoslse3sle4sd",
    "rawData": {},
    "updateMode": false,
    "destructiveUpdate": false,
    "clearHistory": true,
    "apiKey": "keyUselfk2ffjsMsw",
    "verboseLog": false
}
```
The input above assumes that the three specified fields exist in both the Apify dataset and in the Airtable table.


## Notes for developers

This actor does not require the use of **Proxy servers**.

For now this actor is designed to export at most 100,000 records at a time. 
This can be increased by changing the value in constants file. 

Typical usage on Apify platform is shown below:

| Resource | Average | Max |  
| ----- | ---- | ----------- |  
| Memory | 54.3 MB | 87.3 MB |  
| CPU | 2% | 81% |  
