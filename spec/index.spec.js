"use strict";

var matc;

matc = require("..");


/**
 * Call the template cache plugin.
 *
 * @param {Object} options
 * @param {Object} files
 * @return {Promise.<*>}
 */
function callMatc(options, files) {
    return new Promise((resolve, reject) => {
        // Use "null" in place of metalsmith because we don't use that object.
        matc(options)(files, null, (err) => {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
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

    return callMatc(options, files).then(() => {
        result = {
            files
        };

        if (files["templates.js"]) {
            result.content = files["templates.js"].contents.toString("utf8");
        }

        result.expectedStandardContent = "angular.module('templates').run(['$templateCache',function($templateCache){\n$templateCache.put('one.html','This is one');\n$templateCache.put('path/two.html','This is two');\n}]);\n";

        return result;
    });
}

describe("metalsmith-angular-templatecache", () => {
    it("exports a function", () => {
        expect(typeof matc).toBe("function");
    });
    it("generates a function when passed null", () => {
        expect(typeof matc(null)).toBe("function");
    });
    it("generates a function when passed an object", () => {
        expect(typeof matc({})).toBe("function");
    });
    it("works as expected", () => {
        return standardTest({}).then((result) => {
            expect(Buffer.isBuffer(result.files["templates.js"].contents)).toBe(true);
            expect(result.content).toEqual(result.expectedStandardContent);
        });
    });
    it("works with no files", () => {
        var files;

        files = {};

        return callMatc({}, files).then(() => {
            expect(Object.keys(files)).toEqual([
                "templates.js"
            ]);
            expect(Buffer.isBuffer(files["templates.js"].contents)).toBe(true);
            expect(files["templates.js"].mode).toEqual("0644");
            expect(files["templates.js"].contents.toString("utf8")).toEqual("angular.module('templates').run(['$templateCache',function($templateCache){\n}]);\n");
        });
    });
    describe("options", () => {
        describe("bufferEncoding", () => {
            it("honors the buffer encoding", () => {
                var files;

                files = {
                    "x.html": {
                        contents: Buffer.from("000", "utf8")
                    }
                };

                // We know this works when the 2d2d2d in the header is
                // converted to --- in the file.
                return callMatc({
                    bufferEncoding: "hex",
                    templateBody: "{{{contentEscaped}}}",
                    templateHeader: "2d2d2d",
                    templateFooter: ""
                }, files).then(() => {
                    expect(files["templates.js"].contents.toString("utf8")).toEqual("---000");
                });
            });
        });
        describe("destination and destinationMode", () => {
            it("affects the output file", () => {
                return standardTest({
                    destination: "all-html.js",
                    destinationMode: "0755"
                }).then((result) => {
                    expect(result.files["templates.js"]).not.toBeDefined();
                    expect(Buffer.isBuffer(result.files["all-html.js"].contents)).toBe(true);
                    expect(result.files["all-html.js"].mode).toEqual("0755");
                });
            });
        });
        describe("match and matchOptions", () => {
            it("sets a standard baseline", () => {
                return standardTest({}).then((result) => {
                    expect(result.content).toContain("This is one");
                    expect(result.content).toContain("This is two");
                    expect(result.content).not.toContain("This is ignore");
                    expect(result.content).not.toContain("This is hidden");
                });
            });
            it("can limit matching", () => {
                return standardTest({
                    match: "path/**/*"
                }).then((result) => {
                    expect(result.content).not.toContain("This is one");
                    expect(result.content).toContain("This is two");
                    expect(result.content).not.toContain("This is ignore");
                    expect(result.content).not.toContain("This is hidden");
                });
            });
            it("can expand matching", () => {
                return standardTest({
                    matchOptions: {
                        dot: true
                    }
                }).then((result) => {
                    expect(result.content).toContain("This is one");
                    expect(result.content).toContain("This is two");
                    expect(result.content).not.toContain("This is ignore");
                    expect(result.content).toContain("This is hidden");
                });
            });
        });
        describe("module and standalone", () => {
            it("sets a standard baseline", () => {
                return standardTest({}).then((result) => {
                    expect(result.content).toContain("angular.module('templates')");
                });
            });
            it("uses a different module", () => {
                return standardTest({
                    module: "boo"
                }).then((result) => {
                    expect(result.content).toContain("angular.module('boo')");
                });
            });
            it("creates a module", () => {
                return standardTest({
                    standalone: true
                }).then((result) => {
                    expect(result.content).toContain("angular.module('templates',[])");
                });
            });
        });
        describe("moduleSystem", () => {
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

            it("sets a standard baseline", () => {
                return makeWithoutContent({}).then((result) => {
                    expect(result.content).toEqual("-=-");
                });
            });
            it("wraps for browserify", () => {
                return makeWithoutContent({
                    moduleSystem: "BroWSERify"
                }).then((result) => {
                    expect(result.content).toEqual("'use strict';module.exports=-=-");
                });
            });
            it("wraps for es6", () => {
                return makeWithoutContent({
                    moduleSystem: "eS6"
                }).then((result) => {
                    expect(result.content).toEqual("import angular from 'angular'; export default -=-");
                });
            });
            it("wraps for iife", () => {
                return makeWithoutContent({
                    moduleSystem: "iifE"
                }).then((result) => {
                    expect(result.content).toEqual("(function(){ -=- }());");
                });
            });
            it("wraps for requirejs", () => {
                return makeWithoutContent({
                    moduleSystem: "reQUIrejS"
                }).then((result) => {
                    expect(result.content).toEqual("define(['angular'],function(angular){'use strict';return -=- });");
                });
            });
            it("throws for anything else", () => {
                return makeWithoutContent({
                    moduleSystem: "fidUmd"
                }).then(jasmine.fail, () => {});
            });
        });
        describe("removeSource", () => {
            it("sets a standard baseline", () => {
                return standardTest({}).then((result) => {
                    expect(Object.keys(result.files).sort()).toEqual([
                        "ignore.txt",
                        "path/.hidden.html",
                        "templates.js"
                    ]);
                });
            });
            it("preserves if false", () => {
                return standardTest({
                    removeSource: false
                }).then((result) => {
                    expect(Object.keys(result.files).sort()).toEqual([
                        "ignore.txt",
                        "one.html",
                        "path/.hidden.html",
                        "path/two.html",
                        "templates.js"
                    ]);
                });
            });
            it("removes if explicitly set to true", () => {
                return standardTest({
                    removeSource: true
                }).then((result) => {
                    expect(Object.keys(result.files).sort()).toEqual([
                        "ignore.txt",
                        "path/.hidden.html",
                        "templates.js"
                    ]);
                });
            });
        });
        describe("root and templateUrl", () => {
            it("sets a standard baseline", () => {
                return standardTest({}).then((result) => {
                    expect(result.content).toContain("'one.html'");
                    expect(result.content).toContain("'path/two.html'");
                });
            });
            it("applies root", () => {
                return standardTest({
                    root: "asdf"
                }).then((result) => {
                    // It does not automatically add a slash for you.
                    expect(result.content).toContain("'asdfone.html'");
                    expect(result.content).toContain("'asdfpath/two.html'");
                });
            });
            it("applies transformUrl", () => {
                return standardTest({
                    transformUrl(original) {
                        return original.split("").reverse().join("");
                    }
                }).then((result) => {
                    expect(result.content).toContain("'lmth.eno'");
                    expect(result.content).toContain("'lmth.owt/htap'");
                });
            });
            it("uses root and then passes to transformUrl", () => {
                return standardTest({
                    root: "wrong/",
                    transformUrl(original) {
                        return original.replace(/wrong/g, "right");
                    }
                }).then((result) => {
                    expect(result.content).toContain("'right/one.html'");
                    expect(result.content).toContain("'right/path/two.html'");
                });
            });
        });
        describe("templateBody, templateFooter, templateHeader", () => {
            it("can be changed", () => {
                return standardTest({
                    templateBody: "body",
                    templateHeader: "header",
                    templateFooter: "footer"
                }).then((result) => {
                    expect(result.content).toEqual("headerbodybodyfooter");
                });
            });
        });
    });
});
