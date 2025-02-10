import Express, { Router } from "express";

const expressRoutes: Router = Express.Router();

var bsRouter = require('../gen-ai-controllers/business-summary');
var brRouter = require('../gen-ai-controllers/business-rules');
expressRoutes.use('/business-summary', bsRouter);
expressRoutes.use('/business-rules', brRouter);
module.exports = expressRoutes;
