const express = require('express');
const app = express();
const PDFRoutes = require('./api/route/pdf-routes');
const Validation = require('./api/config/validation');
const fileUpload = require('express-fileupload');
// const bodyParser = require('body-parser')

const PORT = process.env.PORT || 8080;

app.use(fileUpload()); // Use express-fileupload middleware
app.use(express.json()) // for parsing application/json
app.use(express.urlencoded({ extended: true })) // for parsing application/x-www-form-urlencoded


//route
app.use('/pdf', PDFRoutes);

Validation.validateRequirements();

const server = app.listen(PORT, function () {
  console.log('Example app listening on port ' + PORT + '!');
});