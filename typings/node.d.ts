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
    id: string
}

interface FrontendJson {
    sourceMapsType?: string,
    accessToken?: string,
    remotePort?: number,
    hmrPort?: number,
    apiPort?: number,
    port?: number,
    ip?: string
}

interface Session {
    token: string
}

interface UserSettings {
    sessionFile: string,
    settingsFolder: string,
    validate(),
    getToken():string,
    setToken(token: string)
}

interface FrontendSettings {
    getIpAddress():Promise<string>,
    getPort():Promise<number>,
    getApiPort():Promise<number>,
    getHmrPort():Promise<number>,
    getRemotePort():Promise<number>,
    getAccessToken():Promise<string>,
    getSourceMapsType():Promise<string>,
    setIpAddress(ip:number):Promise<void>,
    setPort(port:number):Promise<void>,
    setApiPort(apiPort:number):Promise<void>,
    setHmrPort(hmrPort:number):Promise<void>,
    setRemotePort(remotePort:number):Promise<void>,
    setAccessToken(accessToken:string):Promise<void>,
    loadSettings():Promise<FrontendJson>
}

interface AppSettings {
    getApplicationFolder():string,
    validate():AppSettings,
    getId():string,
    setId(id:string):AppSettings,
    attachExtension(pathName:string,extensionInfo:ExtensionInfo,force?:boolean):AppSettings,
    detachExtension(extensionId:string):AppSettings,
    detachAllExtensions():AppSettings,
    getFrontendSettings():FrontendSettings
}

interface Logger {
    debug(str: string): void;
    info(str: string): void;
    log(str: string): void;
    warn(str: string): void;
    error(str: string): void;
}

interface DcHttpClient {
    login(username:string, password:string, cb:Function),
    getInfos (infoType:string, appId:string, deviceId:string, cb:Function),
    downloadPipelines (applicationId:string, trusted):Promise<void>,
    uploadPipeline (pipeline:Pipeline, applicationId:string, trusted):Promise<void>,
    uploadMultiplePipelines(pipelines:Array<Pipeline>, applicationId:string, trusted):Promise<void>,
    removePipeline(pipelineId:string, applicationId:string, trusted):Promise<void>,
    generateExtensionConfig (config:ExtensionConfigJson, applicationId:string, cb:Function),
    getApplicationData(applicationId:string, cb:Function)
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