/**
 * Metalsmith Angular $templateCache
 *
 * Populates the `$templateCache` in Angular by converting the HTML templates
 * into a single JavaScript file.
 *
 * @module metalsmith-angular-templatecache
 */
"use strict";

var debug, jsStringEscape, mustache, pluginKit;

debug = require("debug")("metalsmith-angular-templatecache");
jsStringEscape = require("js-string-escape");
mustache = require("mustache");
pluginKit = require("metalsmith-plugin-kit");


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
        throw new Error(`Invalid module system: ${moduleSystem}`);
    }

    return mustache.render(template, {
        js
    });
}


/**
 * A template file, which is typically an HTML file that is to be converted
 * into JavaScript.
 *
 * @typedef {Object} templateFile
 * @property {Buffer} content
 * @property {string} contentEscaped `.content` converted to a string and escaped for JavaScript.
 * @property {string} filename Filename from Metalsmith.
 * @property {string} uri Generated from filename and options.
 */

/**
 * Takes a file info object and adds a couple properties.
 *
 * .content = Buffer from reading the file
 * .contentEscaped = File contents as an escaped string (not a Buffer)
 * .filename = File's name from Metalsmith
 * .uri = Generated from filename and options
 *
 * @param {module:metalsmith-angular-templatecache~options} options
 * @param {module:metalsmith-angular-templatecache~templateFile} templateFile
 */
function processFileInfo(options, templateFile) {
    var content;

    content = templateFile.content.toString(options.bufferEncoding);
    templateFile.contentEscaped = jsStringEscape(content);
    templateFile.uri = options.transformUrl(options.root + templateFile.filename);
}


/**
 * Options controlling the middleware factory.
 *
 * @typedef {Object} options
 * @property {string} [bufferEncoding=utf8] Used when converting file buffers into strings.
 * @property {string} [destination=templates.js] Destination file that will be generated from the HTML templates.
 * @property {string} [destinationMode=0644] File permissions for the generated file.
 * @property {module:metalsmith-plugin-kit~matchList} [match] Files to match. Defaults to all `*.html` files.
 * @property {module:metalsmith-plugin-kit~matchOptions} [matchOptions={}] Options controlling the matching behavior.
 * @property {string} [module=templates] Name of module that should have these templates.
 * @property {(null|string)} [moduleSystem=null] What module system to use. Can only be one of `browserify`, `es6`, `iife`, and `requirejs`. When falsy, this does not wrap in any module system.
 * @property {boolean} [removeSource=true] When truthy, the template files are removed from the build.
 * @property {string} [root=] Sets the root path to the templates. The path here is prepended to all of the paths of matched files.
 * @property {boolean} [standalone=false] When true, declares the module as a standalone module with no dependencies. Otherwise the module must be declared in other JavaScript.
 * @property {string} [templateBody] Controls how templates are added to the template cache. Mustache template.
 * @property {string} [templateFooter] How the generated JavaScript finishes. Mustache template.
 * @property {string} [templateHeader] How the generated JavaScript starts. Mustache template.
 * @property {Function} [transformUrl] A function that changes the filename into a URL. The default function does not change the filename at all.
 * @see {@link https://github.com/fidian/metalsmith-plugin-kit}
 */

/**
 * Factory to build middleware for Metalsmith.
 *
 * @param {Object} [options]
 * @return {Function}
 */
module.exports = function (options) {
    var templateFiles;

    options = pluginKit.defaultOptions({
        bufferEncoding: "utf8",
        destination: "templates.js",
        destinationMode: "0644",
        match: "**/*.html",
        matchOptions: {},
        module: "templates",
        moduleSystem: null,
        removeSource: true,
        root: "",
        standalone: false,
        templateBody: "$templateCache.put('{{{uri}}}','{{{contentEscaped}}}');\n",
        templateFooter: "}]);\n",
        templateHeader: "angular.module('{{{module}}}'{{#standalone}},[]{{/standalone}}).run(['$templateCache',function($templateCache){\n",
        transformUrl: (input) => {
            return input;
        }
    }, options);

    return pluginKit.middleware({
        after: (files) => {
            var js;

            js = mustache.render(options.templateHeader, options);
            Object.keys(templateFiles).sort().forEach((filename) => {
                var templateFile;

                templateFile = templateFiles[filename];
                processFileInfo(options, templateFile);
                js += mustache.render(options.templateBody, templateFile);
            });
            js += mustache.render(options.templateFooter, options);

            if (options.moduleSystem) {
                js = wrapInModuleSystem(options.moduleSystem, js);
            }

            debug("Writing to %s", options.destination);
            pluginKit.addFile(files, options.destination, js, {
                encoding: options.bufferEncoding,
                mode: options.destinationMode
            });
        },
        before: () => {
            templateFiles = {};
        },
        each: (filename, file, files) => {
            debug("Found template: %s", filename);
            templateFiles[filename] = {
                content: file.contents,
                filename
            };

            if (options.removeSource) {
                delete files[filename];
            }
        },
        match: options.match,
        matchOptions: options.matchOptions,
        name: "metalsmith-angular-templatecache"
    });
};
