"use strict";

// external libs
var express = require("express");
var bodyParser = require('body-parser');
var morgan = require("morgan");
var q = require("q");

// internal libs
var asapi = require("./api/asapi.js");
var AsapiController = require("./controllers/asapi-controller.js");

var configs = [];

module.exports.registerServices = function(serviceConfigs) {
    for (var i=0; i<serviceConfigs.length; i++) {
        var srvConfig = serviceConfigs[i];
        console.log("matrix-appservice: Registering service '%s'", 
            srvConfig.service.serviceName);
        var controller = new AsapiController(asapi);

        // app setup
        var app = express();
        app.use(morgan("combined", {
            stream: {
                write: function(str) {
                    controller.loggerFn(str);
                }
            }
        }));
        app.use(bodyParser.json());
        asapi.setRoutes(app, controller.requestHandler);

        var defer = srvConfig.service.register(controller, srvConfig);
        srvConfig._internal = {
            app: app,
            controller: controller,
            defer: defer
        };
    }
    configs = serviceConfigs;
};

module.exports.getConfigs = function() {
    var configEntries = [];
    configs.forEach(function(config, index) {
        if (config._internal.defer) {
            console.log("matrix-appservice: Waiting on %s register() to finish", 
                config.service.serviceName);
            config._internal.defer.done(function() {
                configEntries.push(getServiceConfig(config));
            });
        }
        else {
            configEntries.push(getServiceConfig(config));
        }
    });
    return configEntries;
};

module.exports.runForever = function() {
    configs.forEach(function(config, index) {
        if (config._internal.defer) {
            console.log("matrix-appservice: Waiting on %s register() to finish", 
                config.service.serviceName);
            config._internal.defer.done(function() {
                runService(config);
            });
        }
        else {
            runService(config);
        }
    });
};

var getServiceConfig = function(config) {
    return {
        url: config.as,
        as_token: config.token,
        hs_token: "foo",
        sender_localpart: "bar",
        namespaces: config._internal.controller.namespaces
    }
};

var runService = function(config) {
    config._internal.controller.register(
            config.hs, config.as, config.token).then(function(hsToken) {
        config._internal.server = config._internal.app.listen(
                config.port || (3000+index), function() {
            var host = config._internal.server.address().address;
            var port = config._internal.server.address().port;
            console.log("matrix-appservice: %s listening at %s on port %s", 
                config.service.serviceName, host, port);
        });
    },
    function(err) {
        console.error(
            "matrix-appservice: %s was unable to register for token: %s", 
            config.service.serviceName, JSON.stringify(err)
        );
    });
};


