import Express, { Request, Response, Router } from "express";
import AppService from "../services/app-service";
const appService: AppService = new AppService();
const router: Router = Express.Router();
var mappings: Array<{ name: string, value: string }> = [
    { name: "user-master", value: "userMaster" },
    { name: "role-master", value: "roleMaster" },
    { name: "file-type-master", value: "fileTypeMaster" }
];

router.use(function (request: Request, response: Response, next) {
    let method: string = request.method.toLowerCase();
    let splitUrl: string[] = request.baseUrl.split('/');
    let urlSegments: string[] = splitUrl.reverse();
    if (urlSegments.length === 6) method = urlSegments.shift();
    let controller: string = urlSegments.shift();
    var value = mappings.find((d) => d.name === controller).value;
    var baseRepository: any = appService.get(value);
    if (!baseRepository) return next();
    let $fn: Function = baseRepository.findMethod(method);
    if (!$fn) return next();
    const { query, params, body } = request;
    const $boundFun = $fn.bind(baseRepository);
    $boundFun({ query, params, body }).then((res: any) => {
        response.status(200).json(res).end();
    }).catch((err: any) => {
        response.status(500).json({ message: err.message, err }).end();
    });
});

module.exports = router;