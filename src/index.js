'use strict';

// load modules
var express = require('express');
var morgan = require('morgan');

var app = express();

var routes = require('./routes');
var seeder = require('mongoose-seeder');
var data = require('./data/data.json');

var jsonParser = require("body-parser").json;

// Use jsonParser
app.use(jsonParser());

// DB setup
var mongoose = require("mongoose");
mongoose.Promise = global.Promise;
mongoose.connect('mongodb://localhost:27017/courses_reset_api');

var db = mongoose.connection;

db.on("error", function(err){
	console.error("connection error:", err);
});

db.once("open", function(){
	console.log("db connection successful");
	// Seed data to database
	seeder.seed(data, { dropDatabase: true})
    .then(function() {
      console.log('Database dropped and seeded successful');
    })
    .catch(function(err) {
      console.error('database seed error: ', err);
    });
});

// morgan gives us http request logging
app.use(morgan('dev'));

// setup our static route to serve files from the "public" folder
app.use('/', express.static('public'));

// Use routes
app.use('/api', routes);

// catch 404 and forward to error handler
app.use(function(req, res, next){
	var err = new Error("Not Found");
	err.status = 404;
	next(err);
});

// Error Handler
app.use(function(err, req, res, next){
	res.status(err.status || 500);
	res.json({
		error: {
			message: err.message
		}
	});
});

// set our port
app.set('port', process.env.PORT || 5000);

// start listening on our port
var server = app.listen(app.get('port'), function() {
	console.log('Express server is listening on port ' + server.address().port);  
});