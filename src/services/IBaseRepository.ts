import Mongoose, { Model, UpdateQuery, Query, HydratedDocument, DeleteResult } from "mongoose";
import { Collection, UpdateResult } from 'mongodb';
import { PartialObject } from 'lodash';
import { EntityBase } from "../models";
export default interface IBaseRepository<TSource extends EntityBase> {
    getModel(): Model<TSource>;
    mongoDbCollection(collName: string): Collection<TSource>;
    addItem(item: TSource): Promise<TSource>;
    getItem(filter: Object): Promise<TSource | null>;
    getDocuments(filter: PartialObject<TSource>, projection?: Object | string | null, options?: Object): Promise<Array<TSource> | []>;
    getAllDocuments(): Promise<Array<TSource>>;
    findById(id: string | Mongoose.Types.ObjectId, projection?: Object | string | null): Promise<TSource | null>;
    searchDocument(filter: PartialObject<TSource>, projection?: Object | string | null, options?: Object): Promise<Array<TSource> | []>;
    findByIdAndUpdate(id: string | Mongoose.Types.ObjectId, fieldsToUpdate: UpdateQuery<TSource>): Promise<TSource>;
    updateDocuments(conditions: PartialObject<TSource>, fieldsToUpdate: PartialObject<TSource>): Promise<UpdateResult>;
    bulkInsert(items: Array<TSource> | TSource): Promise<Array<TSource>>;
    remove(id: string | Mongoose.Types.ObjectId): Promise<Query<TSource, TSource>>;
    removeAll(filter: PartialObject<TSource>, options?: Object): Promise<Mongoose.Query<DeleteResult, TSource, {}>>;
}