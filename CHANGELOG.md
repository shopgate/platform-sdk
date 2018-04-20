## v1.4.0
* Added `logout` command
* Added proper message when one developer runs `backend start` for the same shop while another is still connected
* Fixed concurrent read/write operations when accessing context.storage objects
* Added option to ignore the extension-config.json file of an extension so the config.json won't get updated on start (backend) or on change of extension-config.json; use env `IGNORE_EXT_CONFIG_FOR` with a comma separated list like this: `IGNORE_EXT_CONFIG_FOR="extId1(,extId2,extId3,...)"`
* Added setting the theme URL to local theme when `frontend start` is run and resetting it upon `CTRL + C`
* Added generation of config.json on `frontend start`
* Added a "map" storage type (access via `context.storage.map.<deviceType>`)
* Added promise support for all storage operations
* Updated to use `@shopgate/cloud-sdk-webpack@^1.11.4`

## v1.3.0
* Add promise support for steps
* Added option `--inspect` to `backend start` to allow for inspection/debugging of extensions (props @Menes1337)
* Added generation of config.json for attached extensions on `backend start`
* Creation of (theme)/config/components.json on `frontend start` and extension-config.json change
* Extension pipelines folder can now be empty or missing
* Returning an non error as error in step will show a useful error message
* Fix startup/close bug of frontend/backend process
* Fix path bug of components.json creation
* Fix process termination bug on Windows (not MINGW though)
* Now passing attached extensions to webpack dev server
* Updated to use `@shopgate/cloud-sdk-webpack@^1.10.2`.

## v1.2.4
* Updated to use `@shopgate/cloud-sdk-webpack@^1.10.0`

## v1.2.3
* Updated to use `@shopgate/cloud-sdk-webpack@^1.9.0`

## v1.2.2
* Fix issue of starting the frontend processes twice when using the option '-t' on 'frontend start' command
* Updated to use `@shopgate/cloud-sdk-webpack@^1.8.0`

## v1.2.1
* Only pipeline files with the ending: `.json` will be uploaded on `backend start`
* Fix storage issue that local storage can only be used if `backend start` is executed in project root
* Fix error handing for `frontend` action. The error message are show up now and has the correct format
* Fix problems that configs does not get generated correctly when it has a subpath
* Fix crashing of the SDK on reconnect
* Fix step file watcher will also react on changes in sub directories of "{project}/extensions/{extensionDir}/extension"
* Fix bug that allowed two backend processes to run in the same project
* Rename SDK from `@shopgate/cloud-sdk` to `@shopgate/platform-sdk`

## v1.2.0
* Set minimum node version to 8.4.0
* Improved log, so that step-logs are prefixed with the corresponding step
* The SDK will now ask the user for permission to overwrite the local application-config if a new init is executed in an existing app-folder
* The SDK does not allow two processes of the same kind (frontend/backend) in the same project anymore
* Added support for `react@^16.2.0`
* Improve error handling if user is not logged in
* Hide error stack traces on log level debug
* Add check to validate that pipeline id is equal to the file name
* Logging time values are in local time now
* Update log when pipeline file is invalid; JSON parse error will be displayed
* Better error log, when something's wrong in a step file
* Improve logger output of extension logger
* Project dependend console commands are usable in all subdirectories of a project
* Add extension create command
* Update extension workflow; pipelines don't need to be copied to the global pipeline folder anymore (see documentation)
* From now on the SDK has the command `sgconnect`. `sgcloud` is deprecated from now on

## v1.1.1
* Update `cloud-sdk-webpack` module to v1.5.6.

## v1.1.0
* Pipeline synchronization will now only occur every 500ms to avoid needless uploading of (unfinished) pipelines
* Errors on pipeline upload will now be more verbose
* The command `sgcloud init` will now exit with an error if the application does not exist as development application within the shopgate cloud system
* Better error log if a local step fails
* Fixed unhandled error exception when using unknown command options on init or login command
* Fixed hanging unit tests
* Added update check for the SDK; if outdated, any sgcloud command will show the update message
* Trusted pipelines are now supported

## v1.0.0 - Initial Release
