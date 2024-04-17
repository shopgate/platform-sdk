declare namespace Internal {
    interface AttachedExtension {
        path: string,
        trusted: boolean
    }

    interface ExtensionConfigJson {
        version: string,
        id: string,
        components: any[],
        configuration: Object
    }

    interface ExtensionConfig {
        file: ExtensionConfigJson,
        path: string
    }

    interface ExtensionInfo {
        id: string,
        trusted: boolean,
    }

    interface AppJson {
        id?: string
    }

    interface FrontendJson {
        sourceMapsType?: string,
        accessToken?: string,
        startpageIp?: string,
        remotePort?: number,
        hmrPort?: number,
        apiPort?: number,
        port?: number,
        ip?: string
    }

    interface UserSettings {
        sessionFile: string,
        settingsFolder: string,

        validate(),

        getToken(): string,

        setToken(token: string)
    }

    interface FrontendSettings {
        getIpAddress(): Promise<string>,

        getPort(): Promise<number>,

        getApiPort(): Promise<number>,

        getHmrPort(): Promise<number>,

        getRemotePort(): Promise<number>,

        getAccessToken(): Promise<string>,

        getSourceMapsType(): Promise<string>,

        setIpAddress(ip?: string): Promise<void>,

        setStartpageIpAddress(ip?: string): Promise<void>,

        getStartpageIpAddress(): Promise<string>,

        setSourceMapsType(sourceMapsType?: string): Promise<void>,

        setPort(port: number): Promise<void>,

        setApiPort(apiPort: number): Promise<void>,

        setHmrPort(hmrPort: number): Promise<void>,

        setRemotePort(remotePort: number): Promise<void>,

        setAccessToken(accessToken: string): Promise<void>,

        loadSettings(): Promise<FrontendJson>
    }

    interface AppSettings {
        applicationFolder: string,
        settingsFolder: string,
        settingsFile: string,
        attachedExtensionsFile: string,
        frontendSettings: FrontendSettings,

        getApplicationFolder(): string,

        validate(): Promise<AppSettings>,

        getId(): Promise<string>,

        setId(id: string): Promise<AppSettings>,

        attachExtension(pathName: string, extensionInfo: ExtensionInfo, force?: boolean): Promise<AppSettings>,

        detachExtension(extensionId: string): Promise<AppSettings>,

        detachAllExtensions(): Promise<AppSettings>,

        loadAttachedExtensions(): Promise<{string, AttachedExtension}>,

        getFrontendSettings(): FrontendSettings
    }

    interface Logger {
        debug(str: string): void;

        info(str: string): void;

        log(str: string): void;

        warn(str: string): void;

        error(str: string): void;
    }

    interface DcHttpClient {
        login(username: string, password: string, cb: Function),

        getInfos (infoType: string, appId: string, deviceId: string, cb: Function),

        downloadPipelines (applicationId: string, trusted): Promise<void>,

        uploadPipeline (pipeline: Pipeline, applicationId: string, trusted): Promise<void>,

        uploadMultiplePipelines(pipelines: Array<Pipeline>, applicationId: string, trusted): Promise<void>,

        removePipeline(pipelineId: string, applicationId: string, trusted): Promise<void>,

        generateExtensionConfig (config: ExtensionConfigJson, applicationId: string),

        getApplicationData(applicationId: string, cb: Function)
    }

    interface DcRequester {
        requestAppInfo(appId: string, deviceId: string, cb: Function): void,

        requestDeviceInfo(appId: string, deviceId: string, cb: Function): void,

        request(resourceName: string, appId: string, deviceId: string, cb: Function): void,

        pull(requestId: string): Function
    }

    interface Input {
        id: string;
        key: string;
    }

    interface Output {
        id: string;
        key: string;
    }

    interface Step {
        id: string;
        path: string;
        type: string;
        input: Input[];
        output: Output[];
    }

    interface Pipeline {
        id: string,
        input: Input[],
        steps: Step[],
        output: Output[],
        public: boolean
    }

    interface PipelineJson {
        version: string,
        pipeline: Pipeline
    }
}
