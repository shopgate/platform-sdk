## v1.1.0
* Pipeline synchronization will now only occur every 500ms to avoid needless uploading of (unfinished) pipelines
* The command sgcloud init will now exit with an error if the application does not exist as development application within the shopgate cloud system
* Better error log if a local step fails
* Fixed unhandled error exception when using unkown command options on init or login command
* The SDK will now ask the user for permission to overwrite the local application-config if a new init is executed in an existing app-folder.

## v1.0.0 - Initial Release
