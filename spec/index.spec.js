"use strict";

var matc;

matc = require("..");


/**
 * Call the template cache plugin.
 *
 * @param {Object} options
 * @param {Object} files
 */
function callMatc(options, files) {
    // Use "null" in place of metalsmith because we don't use that object.
    // Simulate the callback because this is all synchronous.
    matc(options)(files, null, function () {});
}


/**
 * Creates a set of files and issues a call to the plugin using the options
 * specified. The object returned from this function is designed to help
 * with testing.
 *
 * @param {Object} options
 * @return {Object}
 */
function standardTest(options) {
    var files, result;

    files = {
        "ignore.txt": {
            contents: Buffer.from("This is ignore", "utf8")
        },
        "one.html": {
            contents: Buffer.from("This is one", "utf8")
        },
        "path/two.html": {
            contents: Buffer.from("This is two", "utf8")
        },
        "path/.hidden.html": {
            contents: Buffer.from("This is hidden", "utf8")
        }
    };
    callMatc(options, files);

    result = {
        files: files
    };

    if (files["templates.js"]) {
        result.content = files["templates.js"].contents.toString("utf8");
    }

    result.expectedStandardContent = "angular.module('templates').run(['$templateCache',function($templateCache){\n$templateCache.put('one.html','This is one');\n$templateCache.put('path/two.html','This is two');\n}]);\n";

    return result;
}

describe("metalsmith-angular-templatecache", function () {
    it("exports a function", function () {
        expect(typeof matc).toBe("function");
    });
    it("generates a function when passed null", function () {
        expect(typeof matc(null)).toBe("function");
    });
    it("generates a function when passed an object", function () {
        expect(typeof matc({})).toBe("function");
    });
    it("sets default parameters", function () {
        var options;

        options = {};
        matc(options);
        expect(options).toEqual({
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
            templateBody: jasmine.any(String),
            templateFooter: jasmine.any(String),
            templateHeader: jasmine.any(String),
            transformUrl: jasmine.any(Function)
        });
    });
    it("works as expected", function () {
        var result;

        result = standardTest({});
        expect(Buffer.isBuffer(result.files["templates.js"].contents)).toBe(true);
        expect(result.content).toEqual(result.expectedStandardContent);
    });
    it("works with no files", function () {
        var files;

        files = {};
        callMatc({}, files);
        expect(Object.keys(files)).toEqual([
            "templates.js"
        ]);
        expect(Buffer.isBuffer(files["templates.js"].contents)).toBe(true);
        expect(files["templates.js"].mode).toEqual("0644");
        expect(files["templates.js"].contents.toString("utf8")).toEqual("angular.module('templates').run(['$templateCache',function($templateCache){\n}]);\n");
    });
    describe("options", function () {
        describe("bufferEncoding", function () {
            it("honors the buffer encoding", function () {
                var files;

                files = {
                    "x.html": {
                        contents: Buffer.from("000", "utf8")
                    }
                };

                // We know this works when the 2d2d2d in the header is
                // converted to --- in the file.
                callMatc({
                    bufferEncoding: "hex",
                    templateBody: "{{{contentEscaped}}}",
                    templateHeader: "2d2d2d",
                    templateFooter: ""
                }, files);
                expect(files["templates.js"].contents.toString("utf8")).toEqual("---000");
            });
        });
        describe("destination and destinationMode", function () {
            it("affects the output file", function () {
                var result;

                result = standardTest({
                    destination: "all-html.js",
                    destinationMode: "0755"
                });
                expect(result.files["templates.js"]).not.toBeDefined();
                expect(Buffer.isBuffer(result.files["all-html.js"].contents)).toBe(true);
                expect(result.files["all-html.js"].mode).toEqual("0755");
            });
        });
        describe("match and matchOptions", function () {
            it("sets a standard baseline", function () {
                var result;

                result = standardTest({});
                expect(result.content).toContain("This is one");
                expect(result.content).toContain("This is two");
                expect(result.content).not.toContain("This is ignore");
                expect(result.content).not.toContain("This is hidden");
            });
            it("can limit matching", function () {
                var result;

                result = standardTest({
                    match: "path/**/*"
                });
                expect(result.content).not.toContain("This is one");
                expect(result.content).toContain("This is two");
                expect(result.content).not.toContain("This is ignore");
                expect(result.content).not.toContain("This is hidden");
            });
            it("can expand matching", function () {
                var result;

                result = standardTest({
                    matchOptions: {
                        dot: true
                    }
                });
                expect(result.content).toContain("This is one");
                expect(result.content).toContain("This is two");
                expect(result.content).not.toContain("This is ignore");
                expect(result.content).toContain("This is hidden");
            });
        });
        describe("module and standalone", function () {
            it("sets a standard baseline", function () {
                var result;

                result = standardTest({});
                expect(result.content).toContain("angular.module('templates')");
            });
            it("uses a different module", function () {
                var result;

                result = standardTest({
                    module: "boo"
                });
                expect(result.content).toContain("angular.module('boo')");
            });
            it("creates a module", function () {
                var result;

                result = standardTest({
                    standalone: true
                });
                expect(result.content).toContain("angular.module('templates',[])");
            });
        });
        describe("moduleSystem", function () {
            /**
             * Helper function to test the wrapping of the generated code.
             * We remove all of the template-related code and replace it
             * with "-=-" to make these tests far easier.
             *
             * @param {Object} options
             * @return {Object}
             */
            function makeWithoutContent(options) {
                options.templateBody = "";
                options.templateFooter = "";
                options.templateHeader = "-=-";

                return standardTest(options);
            }

            it("sets a standard baseline", function () {
                var result;

                result = makeWithoutContent({});
                expect(result.content).toEqual("-=-");
            });
            it("wraps for browserify", function () {
                var result;

                result = makeWithoutContent({
                    moduleSystem: "BroWSERify"
                });
                expect(result.content).toEqual("'use strict';module.exports=-=-");
            });
            it("wraps for es6", function () {
                var result;

                result = makeWithoutContent({
                    moduleSystem: "eS6"
                });
                expect(result.content).toEqual("import angular from 'angular'; export default -=-");
            });
            it("wraps for iife", function () {
                var result;

                result = makeWithoutContent({
                    moduleSystem: "iifE"
                });
                expect(result.content).toEqual("(function(){ -=- }());");
            });
            it("wraps for requirejs", function () {
                var result;

                result = makeWithoutContent({
                    moduleSystem: "reQUIrejS"
                });
                expect(result.content).toEqual("define(['angular'],function(angular){'use strict';return -=- });");
            });
            it("throws for anything else", function () {
                expect(function () {
                    makeWithoutContent({
                        moduleSystem: "fidUmd"
                    });
                }).toThrow();
            });
        });
        describe("removeSource", function () {
            it("sets a standard baseline", function () {
                var result;

                result = standardTest({});
                expect(Object.keys(result.files).sort()).toEqual([
                    "ignore.txt",
                    "path/.hidden.html",
                    "templates.js"
                ]);
            });
            it("preserves if false", function () {
                var result;

                result = standardTest({
                    removeSource: false
                });
                expect(Object.keys(result.files).sort()).toEqual([
                    "ignore.txt",
                    "one.html",
                    "path/.hidden.html",
                    "path/two.html",
                    "templates.js"
                ]);
            });
            it("removes if explicitly set to true", function () {
                var result;

                result = standardTest({
                    removeSource: true
                });
                expect(Object.keys(result.files).sort()).toEqual([
                    "ignore.txt",
                    "path/.hidden.html",
                    "templates.js"
                ]);
            });
        });
        describe("root and templateUrl", function () {
            it("sets a standard baseline", function () {
                var result;

                result = standardTest({});
                expect(result.content).toContain("'one.html'");
                expect(result.content).toContain("'path/two.html'");
            });
            it("applies root", function () {
                var result;

                result = standardTest({
                    root: "asdf"
                });

                // It does not automatically add a slash for you.
                expect(result.content).toContain("'asdfone.html'");
                expect(result.content).toContain("'asdfpath/two.html'");
            });
            it("applies transformUrl", function () {
                var result;

                result = standardTest({
                    transformUrl: function (original) {
                        return original.split("").reverse().join("");
                    }
                });
                expect(result.content).toContain("'lmth.eno'");
                expect(result.content).toContain("'lmth.owt/htap'");
            });
            it("uses root and then passes to transformUrl", function () {
                var result;

                result = standardTest({
                    root: "wrong/",
                    transformUrl: function (original) {
                        return original.replace(/wrong/g, "right");
                    }
                });
                expect(result.content).toContain("'right/one.html'");
                expect(result.content).toContain("'right/path/two.html'");
            });
        });
        describe("templateBody, templateFooter, templateHeader", function () {
            it("can be changed", function () {
                var result;

                result = standardTest({
                    templateBody: "body",
                    templateHeader: "header",
                    templateFooter: "footer"
                });
                expect(result.content).toEqual("headerbodybodyfooter");
            });
        });
    });
});
