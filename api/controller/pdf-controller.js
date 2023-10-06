const service = require('../service/pdf-service');
const FileService = require('../service/file-service');

const PUBLIC_KEY_FILE_PATH = process.env.PUBLIC_KEY_FILE_PATH;

const sign2 = async (req, res, next) => {

    if (!req.files || Object.keys(req.files).length === 0) {
        return res.status(400).send('No files were uploaded.');
    }

    try {
        const filename = req.body.filename || 'signed_document';
        const pdf = req.files.pdf;
        const p12 = req.files.p12;
        const password = req.body.password;
        const signedPDF = await service.sign2(pdf, p12, password);

        console.log("signedPDF: ", signedPDF);

        if (signedPDF) {
            res.setHeader('Content-Length', signedPDF.length);
        }
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=' + filename + '.pdf');
        res.status(200).send(signedPDF);
    } catch (err) {
        console.error(err);
        res.status(500).send(err.message);
    }
}

const sign = async (req, res, next) => {

    if (!req.files || Object.keys(req.files).length === 0) {
        return res.status(400).send('No files were uploaded.');
    }

    try {
        const filename = req.body.filename || 'signed_document';
        const pdf = req.files.pdf;
        const p12 = req.files.p12;
        const password = req.body.password;

        service.sign(pdf, p12, password).then((data) => {
            if (data) {
                res.setHeader('Content-Length', data.length);
                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', 'attachment; filename=' + filename + '.pdf');
                res.status(200).send(data);
            }
        }).catch(err => {
            res.status(500).send(err);
        });

    } catch (err) {
        console.error(err);
        res.status(500).send(err.message);
    }
}

const verify = async (req, res, next) => {
    if (!req.files || Object.keys(req.files).length === 0) {
        return res.status(400).send('No files were uploaded.');
    }

    try {
        const signedPDF = req.files.pdf;
        const verifiedString = await service.verify(signedPDF);
        res.status(200).send(verifiedString);
    } catch (err) {
        console.error(err);
        res.status(500).send(err.message);
    }
}

const getPublicKey = async (req, res, next) => {
    try {
        const publicKey = await FileService.readFile(PUBLIC_KEY_FILE_PATH);
        const result = publicKey.toString('utf8');
        res.setHeader('Content-Length', result.length);
        res.setHeader('Content-Type', 'text/plain');
        res.status(200).send(result);
    } catch (err) {
        console.error(err);
        res.status(500).send(err.message);
    }
}

module.exports = {
    sign2,
    sign,
    verify,
    getPublicKey
}