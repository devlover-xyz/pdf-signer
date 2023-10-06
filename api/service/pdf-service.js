const fs = require('fs');
const path = require('path');
const uuidv4 = require('uuid/v4');
const { spawnSync, exec, execSync, spawn } = require('child_process');
const Crypto = require('../util/crypto');
const RequestValidator = require('../util/request-validator');
const { writeFile, readFile, unlink } = require('fs/promises');
const { tmpdir } = require('os');
const signPDF = require('jsignpdf').default;
const { resolve: resolvePath } = require('path');

const SIGNER_JAR = path.join(__dirname, '../../', 'jsignpdf', 'JSignPdf.jar');
const OPTION_PROP = path.join(__dirname, '../../', 'jsignpdf', 'conf', 'conf.properties');
const VERIFIER_JAR = path.join(__dirname, '../../', 'jsignpdf', 'Verifier.jar');
const PRIVATE_KEY = fs.readFileSync(process.env.PRIVATE_KEY_FILE_PATH);

const sign2 = async (pdf, p12, password) => {

    const tmpPdfFolder = path.join(__dirname, '../../', 'tmp', uuidv4());
    const pdfFileName = path.join(tmpPdfFolder, pdf.name);
    const p12Filename = path.join(tmpPdfFolder, p12.name);
    const signedPdfFolder = path.join(__dirname, '../../', 'tmp', 'signed');
    const pdfSignedFileName = path.join(signedPdfFolder, 'signed_' + pdf.name);

    spawnSync('mkdir', [tmpPdfFolder]);
    spawnSync('mkdir', [signedPdfFolder]);

    // Move the uploaded file to the server
    pdf.mv(pdfFileName, (err) => {
        if (err) {
            console.log(err);
        }
    });

    p12.mv(p12Filename, (err) => {
        if (err) {
            console.log(err);
        }
    });

    const options = {
        keyType: 'PKCS12',
        hashAlgorithm: 'SHA256',
        tsaHashAlgorithm: 'SHA256',
        appendSignature: true,
        reason: "Dokumen telah ditandatagani secara elektronik",
        '-ka': "Rakhmat Thahir", 
    };
    const signed = await signPDF(
        pdfFileName,    // your existing PDF
        p12Filename,    // your signing p12 certificate 
        password,    // passhrase to your certificate (optional)
        options
    )

    return signed;
}

const sign = async (pdf, p12, password) => {
    RequestValidator.isNotNull('pdf', pdf);
    RequestValidator.isNotNull('p12', p12);
    RequestValidator.isNotNull('password', password);

    const timeout = 10000;
    // const tmpPdfFolder = path.join(__dirname, '../../', 'tmp', uuidv4());
    const tmpPdfFolder = path.join(tmpdir(), uuidv4());
    const pdfFileName = path.join(tmpPdfFolder, pdf.name);
    const p12FileName = path.join(tmpPdfFolder, p12.name);
    const pdfSignedFileName = path.join(tmpPdfFolder, 'signed_' + pdf.name);

    spawnSync('mkdir', [tmpPdfFolder]);

    // const signedPdfFolder = path.join(__dirname, '../../', 'tmp', 'signed');
    // const pdfSignedFileName = path.join(signedPdfFolder, 'signed_' + pdf.name);
    // spawnSync('mkdir', [signedPdfFolder]);

    // const decryptedPassword = Crypto.decrypt(password, PRIVATE_KEY);
    const decryptedPassword = password;

    // Move the uploaded file to the server
    pdf.mv(pdfFileName, (err) => {
        if (err) {
            console.log(err);
        }
    });

    p12.mv(p12FileName, (err) => {
        if (err) {
            console.log(err);
        }
    });

    return new Promise((resolve, reject) => {

        /**
         * FOR MANUAL TESTING
         * java -jar JSignPdf.jar -a -kst PKCS12 -ksp "19Ded4@ser475" -ksf test/197211032002121005.p12 -tsh SHA256 -ha SHA256 -d test/ -op "signed_" -os "" -r "Dokumen telah ditandatagani secara elektronik" -ka "Rakhmat Thahir" -q test/sppt.pdf
         */
        const command = [
            'java', '-jar', SIGNER_JAR,
            '-a',
            '-kst', 'PKCS12',
            '-ksp', decryptedPassword,
            '-ksf', p12FileName,
            '-tsh', 'SHA256',
            '-ha', 'SHA256',
            '-op', '"signed_"', //output prefix
            '-os', '""', //output suffix
            '-r', '"Dokumen telah ditandatagani secara elektronik"', //reason
            '-ka', '"Rakhmat Thahir"', // key alias
            '-q',
            // '-V', //visible signature
            '-d', tmpPdfFolder, //output directory
            pdfFileName
        ].filter(r => !!r).join(' ');

        exec(command, {
            timeout
        }, async err => {
            
            const data = await readFile(pdfSignedFileName).catch(() => null);
            
            console.log('READ File: ' + pdfSignedFileName);
            console.log('File Length: ' + data?.length);

            await Promise.all([
                unlink(p12FileName),
                unlink(pdfFileName),
                data && unlink(pdfSignedFileName)
            ])

            if (err) {
                console.log('ERROR exec: ' + err);
                return reject(err)
            }
            if (!data || !data.length) return reject(new Error('Unable to Sign PDF. Result is Empty'));

            resolve(data)
        })
    }).catch(e => {
        if (e.code === 127)
            throw new Error(`Unable to Sign PDF. Java Not Installed?`)
        if (e.code === 126)
            throw new Error(`Unable to Sign PDF. Permissions denied for [java]`)
        if (e.killed)
            throw new Error(`Unable to Sign PDF. Process Killed. Timeout?`)

        const msg = e.message?.match(/java.io.IOException: (.*)\n/)?.[1]
        console.log(e);

        if (msg) {
            throw new Error(msg || 'Unable to Sign PDF. Incorrect Password or something wrong?')
        }
    });
}

const verify = async (pdf) => {

    RequestValidator.isNotNull('pdf', pdf);

    const tmpPdfFolder = path.join(__dirname, '../../', 'tmp', uuidv4());
    const pdfFileName = path.join(tmpPdfFolder, 'demo.pdf');

    try {

        spawnSync('mkdir', [tmpPdfFolder]);
        fs.writeFileSync(pdfFileName, pdf.name);

        const child = spawnSync('java', [
            '-jar',
            VERIFIER_JAR,
            '-ff',
            pdfFileName
        ]);

        const { error, stderr, stdout } = child;
        if (error) {
            throw error;
        } else if (stderr.toString('utf8').length > 0) {
            throw new Error(stderr.toString('utf8'));
        }
        return stdout.toString('utf8');
    } catch (err) {
        throw err;
    } finally {
        spawnSync('rm', ['-rf', tmpPdfFolder]);
    }
}

module.exports = {
    sign2,
    sign,
    verify
}