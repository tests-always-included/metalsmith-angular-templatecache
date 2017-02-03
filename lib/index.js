"use strict";

var debug, jsStringEscape, minimatch, mustache;

debug = require("debug")("metalsmith-angular-templatecache");
jsStringEscape = require("js-string-escape");
minimatch = require("minimatch");
mustache = require("mustache");


/**
 * Manages the options and sets defaults.
 *
 * @param {Object} [options]
 * @return {Object}
 */
function setDefaultOptions(options) {
    /**
     * Sets a single option to be a defaulted value.
     *
     * @param {string} property
     * @param {*} defaultValue
     */
    function setDefault(property, defaultValue) {
        if (!options[property] && options[property] !== "") {
            options[property] = defaultValue;
        }
    }


    options = options || {};

    // Must check against undefined because `false` shouldn't be overridden.
    if (typeof options.removeSource === "undefined") {
        options.removeSource = true;
    }

    // Simplifies logic later.
    if (typeof options.transformUrl !== "function") {
        options.transformUrl = function (input) {
            return input;
        };
    }

    // Typecasts
    options.removeSource = !!options.removeSource;
    options.standalone = !!options.standalone;

    // The rest of the defaults will override falsy values.
    setDefault("bufferEncoding", "utf8");
    setDefault("destination", "templates.js");
    setDefault("destinationMode", "0644");
    setDefault("match", "**/*.html");
    setDefault("matchOptions", {});
    setDefault("module", "templates");
    setDefault("moduleSystem", null);
    setDefault("root", "");
    setDefault("templateBody", "$templateCache.put('{{{uri}}}','{{{contentEscaped}}}');\n");
    setDefault("templateFooter", "}]);\n");
    setDefault("templateHeader", "angular.module('{{{module}}}'{{#standalone}},[]{{/standalone}}).run(['$templateCache',function($templateCache){\n");

    return options;
}


/**
 * Wraps JavaScript in a given module system's loader.
 *
 * @param {string} moduleSystem
 * @param {string} js
 * @return {string}
 */
function wrapInModuleSystem(moduleSystem, js) {
    var template;

    switch (moduleSystem.toLowerCase()) {
    case "browserify":
        template = "'use strict';module.exports={{{js}}}";
        break;

    case "es6":
        template = "import angular from 'angular'; export default {{{js}}}";
        break;

    case "iife":
        template = "(function(){ {{{js}}} }());";
        break;

    case "requirejs":
        template = "define(['angular'],function(angular){'use strict';return {{{js}}} });";
        break;

    default:
        throw new Error("Invalid module system: " + moduleSystem);
    }

    return mustache.render(template, {
        js: js
    });
}


/**
 * Takes a file info object and adds a couple properties.
 *
 * .content = Buffer from reading the file
 * .contentEscaped = File contents as an escaped string (not a Buffer)
 * .filename = File's name from Metalsmith
 * .uri = Generated from filename and options
 *
 * @param {Object} options
 * @param {Object} templateFile
 */
function processFileInfo(options, templateFile) {
    var content;

    content = templateFile.content.toString(options.bufferEncoding);
    templateFile.contentEscaped = jsStringEscape(content);
    templateFile.uri = options.transformUrl(options.root + templateFile.filename);
}


/**
 * Factory to build middleware for Metalsmith.
 *
 * @param {Object} [options]
 * @return {Function}
 */
module.exports = function (options) {
    var matcher;

    options = setDefaultOptions(options);
    matcher = new minimatch.Minimatch(options.match, options.matchOptions);

    /**
     * Middleware function.
     *
     * @param {Object} files
     * @param {Object} metalsmith
     * @param {Function} done
     */
    return function (files, metalsmith, done) {
        var js, templateFiles;

        templateFiles = [];
        Object.keys(files).forEach(function (sourceFile) {
            if (matcher.match(sourceFile) && files[sourceFile]) {
                debug("Found template: %s", sourceFile);
                templateFiles.push({
                    filename: sourceFile,
                    content: files[sourceFile].contents
                });

                if (options.removeSource) {
                    delete files[sourceFile];
                }
            }
        });

        js = mustache.render(options.templateHeader, options);
        templateFiles.forEach(function (templateFile) {
            processFileInfo(options, templateFile);
            js += mustache.render(options.templateBody, templateFile);
        });
        js += mustache.render(options.templateFooter, options);

        if (options.moduleSystem) {
            js = wrapInModuleSystem(options.moduleSystem, js);
        }

        debug("Writing to %s", options.destination);
        files[options.destination] = {
            contents: Buffer.from(js, options.bufferEncoding),
            mode: options.destinationMode
        };
        done();
    };
};
