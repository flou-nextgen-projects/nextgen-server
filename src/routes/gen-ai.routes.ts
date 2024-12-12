import Express, { Router } from "express";

const expressRoutes: Router = Express.Router();

var bsRouter = require('../gen-ai-controllers/business-summary');

expressRoutes.use('/business-summary', bsRouter);

module.exports = expressRoutes;
