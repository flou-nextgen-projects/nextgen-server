import BaseRepository from './BaseRepository';
import { Db, MongoClient } from 'mongodb';
import Mongoose from 'mongoose';
const globalAny: any = global;
const dbConnection: Mongoose.Connection = globalAny.dbConnection as Mongoose.Connection;
const mongoClient: MongoClient = globalAny.mongoDbClient as MongoClient;
import {
    EntityBase, MultipleCollectionsConfig, RoleMaster, UserMaster, UserMasterSchema, RoleMasterSchema,
    ProjectMaster, ProjectMasterSchema, LanguageMaster, WorkspaceMaster, LanguageMasterSchema,
    WorkspaceMasterSchema, FileTypeMasterSchema, FileTypeMaster,
    FileMaster, FileMasterSchema, StatementMaster, StatementSchema, BaseCommandMasterSchema, BaseCommandMaster, FileContentMaster,
    FileContentMasterSchema, ProcessingStages, ProcessingStagesSchema, ProjectDirInfoSchema, ProjectDirInfo, UniVerseFileMenuSchema,
    UniVerseFileMenuMaster, UniVerseDataDictionarySchema, UniVerseDataDictionary, UniVerseDescriptorSchema, UniVerseDescriptorMaster,
    BaseCommandRefSchema, BaseCommandReference, CobolDataSet, CobolDataSetSchema,
    BmsMapControl, BmsMapControlSchema, BmsMapMaster, BmsMapMasterSchema, ExternalCalls, ExternalCallsSchema,
    DataDependency, DataDependencySchema, EntityMaster, EntityMasterSchema, EntityAttributes, EntityAttributesSchema,
    CobolEntities, CobolVariableSchema, CobolVariables, CobolEntitiesSchema,
    PromptConfigMaster,
    PromptConfigMasterSchema
} from '../models';

class AppService {
    public mongoDbClient: MongoClient;
    public mongooseConnection: Mongoose.Connection = dbConnection;
    public mongoDatabase: Db;
    constructor() {
        this.mongoDbClient = mongoClient;
        this.mongooseConnection = dbConnection;
    }

    public roleMaster: BaseRepository<RoleMaster> = new BaseRepository<RoleMaster>({ collectionName: "roleMaster", schema: RoleMasterSchema });
    public userMaster: BaseRepository<UserMaster> = new BaseRepository<UserMaster>({ collectionName: "userMaster", schema: UserMasterSchema });
    public schemaDefaults: Object = { autopopulate: true, versionKey: false, virtuals: true, getters: true, defaults: true, flattenMap: false };
    public languageMaster = new BaseRepository<LanguageMaster>({ collectionName: "languageMaster", schema: LanguageMasterSchema });
    public baseCommandMaster = new BaseRepository<BaseCommandMaster>({ collectionName: "baseCommandMaster", schema: BaseCommandMasterSchema });
    public baseCommandReference = new BaseRepository<BaseCommandReference>({ collectionName: "baseCommandReference", schema: BaseCommandRefSchema });
    public workspaceMaster = new BaseRepository<WorkspaceMaster>({ collectionName: "workspaceMaster", schema: WorkspaceMasterSchema });
    public projectMaster = new BaseRepository<ProjectMaster>({ collectionName: "projectMaster", schema: ProjectMasterSchema });
    public fileTypeMaster = new BaseRepository<FileTypeMaster>({ collectionName: "fileTypeMaster", schema: FileTypeMasterSchema });
    public fileMaster = new BaseRepository<FileMaster>({ collectionName: "fileMaster", schema: FileMasterSchema });
    public fileContentMaster = new BaseRepository<FileContentMaster>({ collectionName: "fileContents", schema: FileContentMasterSchema });
    public processingStages = new BaseRepository<ProcessingStages>({ collectionName: "processingStages", schema: ProcessingStagesSchema });
    public projectDirInfo = new BaseRepository<ProjectDirInfo>({ collectionName: "projectDirInfo", schema: ProjectDirInfoSchema });
    public statementMaster = new BaseRepository<StatementMaster>({ collectionName: "statementMaster", schema: StatementSchema });
    public uniVerseFileMenuMaster = new BaseRepository<UniVerseFileMenuMaster>({ collectionName: "universeFileMenuMaster", schema: UniVerseFileMenuSchema });
    public uniVerseDataDictionaryMaster = new BaseRepository<UniVerseDataDictionary>({ collectionName: "universeDataDictionaryMaster", schema: UniVerseDataDictionarySchema });
    public uniVerseDescriptorMaster = new BaseRepository<UniVerseDescriptorMaster>({ collectionName: "universeDescriptorMaster", schema: UniVerseDescriptorSchema });
    public cobolDataSets = new BaseRepository<CobolDataSet>({ collectionName: "cobolDataSets", schema: CobolDataSetSchema });
    public bmsMapMaster = new BaseRepository<BmsMapMaster>({ collectionName: "bmsMapMaster", schema: BmsMapMasterSchema });
    public bmsMapControls = new BaseRepository<BmsMapControl>({ collectionName: "bmsMapControls", schema: BmsMapControlSchema });
    public externalCalls = new BaseRepository<ExternalCalls>({ collectionName: "externalCalls", schema: ExternalCallsSchema });
    public dataDependency = new BaseRepository<DataDependency>({ collectionName: "dataDependency", schema: DataDependencySchema });
    public entityMaster = new BaseRepository<EntityMaster>({ collectionName: "entityMaster", schema: EntityMasterSchema });
    public entityAttributes = new BaseRepository<EntityAttributes>({ collectionName: "entityMaster", schema: EntityAttributesSchema });
    public cobolVariables = new BaseRepository<CobolVariables>({ collectionName: "cobolVariables", schema: CobolVariableSchema });
    public cobolEntities = new BaseRepository<CobolEntities>({ collectionName: "cobolEntities", schema: CobolEntitiesSchema });
    public promptConfig = new BaseRepository<PromptConfigMaster>({ collectionName: "promptConfigMaster", schema: PromptConfigMasterSchema });
    public objectConnectivity = new BaseRepository<any>({ collectionName: "objectConnectivity", schema: new Mongoose.Schema<any>() });
    public memberReferences = new BaseRepository<any>({ collectionName: "memberReferences", schema: new Mongoose.Schema<any>() });

    get = function <T extends EntityBase>(propertyName: string): BaseRepository<T> { return this[propertyName]; };
    dataSets = async (collections: Array<MultipleCollectionsConfig>): Promise<Array<{ collection: string, documents: any[] }>> => {
        var tableData: Array<{ collection: string, documents: any[] }> = [];
        for (const key of collections) {
            var model = this.mongooseConnection.model(key.collection);
            var docs = await model.find(key.filter, key.projection, key.options).lean(this.schemaDefaults);
            tableData.push({ collection: key.collection, documents: docs });
        }
        return tableData;
    };
}

export const appService: AppService = new AppService();
export default AppService;