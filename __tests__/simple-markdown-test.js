var assert = require("assert");
var nodeUtil = require("util");
var _ = require("underscore");
var React = require("react");

var SimpleMarkdown = require("../simple-markdown.js");
var defaultParse = SimpleMarkdown.defaultParse;
var defaultOutput = SimpleMarkdown.defaultOutput;

// A pretty-printer that handles `undefined` and functions better
// than JSON.stringify
// Important because some AST node fields can be undefined, and
// if those don't show up in the assert output, it can be
// very confusing to figure out how the actual and expected differ
var prettyPrintAST = function(ast) {
    return nodeUtil.inspect(ast, {
        depth: null,
        colors: false
    });
};

var validateParse = function(parsed, expected) {
    if (!_.isEqual(parsed, expected)) {
        var parsedStr = prettyPrintAST(parsed);
        var expectedStr = prettyPrintAST(expected);
        assert.fail(
            parsedStr,
            expectedStr,
            "parsed did not match expected",
            "<>"
        );
    }
};

var htmlThroughReact = function(parsed) {
    var output = defaultOutput(parsed);
    var rawHtml = React.renderToStaticMarkup(
        React.DOM.div(null, output)
    );
    var innerHtml = rawHtml
        .replace(/^<div>/, '')
        .replace(/<\/div>$/, '');
    var simplifiedHtml = innerHtml
        .replace(/>\n*/g, '>')
        .replace(/\n*</g, '<')
        .replace(/\s+/g, ' ');
    return simplifiedHtml;
};

var htmlFromMarkdown = function(source) {
    return htmlThroughReact(defaultParse(source));
};

describe("simple markdown", function() {
    describe("parser", function() {
        it("should parse a plain string", function() {
            var parsed = defaultParse("hi there");
            validateParse(parsed, [{
                type: "text",
                content: "hi there"
            }]);
        });

        it("should parse bold", function() {
            var parsed = defaultParse("**hi**");
            validateParse(parsed, [{
                type: "strong",
                content: [{
                    type: "text",
                    content: "hi"
                }]
            }]);
        });

        it("should parse italics", function() {
            var parsed = defaultParse("*hi*");
            validateParse(parsed, [{
                type: "em",
                content: [{
                    type: "text",
                    content: "hi"
                }]
            }]);
        });

        it("should parse strikethrough", function() {
            var parsed = defaultParse("~~hi~~");
            validateParse(parsed, [{
                type: "del",
                content: [{
                    type: "text",
                    content: "hi"
                }]
            }]);

            // not super important that it parses this like this, but
            // it should be a valid something...
            var parsed2 = defaultParse("~~~~~");
            validateParse(parsed2, [{
                type: "del",
                content: [{
                    type: "text",
                    content: "~"
                }]
            }]);
        });

        it("should parse underlines", function() {
            var parsed = defaultParse("__hi__");
            validateParse(parsed, [{
                type: "u",
                content: [{
                    type: "text",
                    content: "hi"
                }]
            }]);
        });

        it("should parse nested bold/italics", function() {
            var parsed = defaultParse("***hi***");
            validateParse(parsed, [{
                type: "strong",
                content: [{
                    type: "em",
                    content: [{
                        type: "text",
                        content: "hi"
                    }]
                }]
            }]);
        });

        it("should parse nested bold/italics/underline", function() {
            var parsed1 = defaultParse("***__hi__***");
            validateParse(parsed1, [{
                type: "strong",
                content: [{
                    type: "em",
                    content: [{
                        type: "u",
                        content: [{
                            type: "text",
                            content: "hi"
                        }]
                    }]
                }]
            }]);

            var parsed2 = defaultParse("*__**hi**__*");
            validateParse(parsed2, [{
                type: "em",
                content: [{
                    type: "u",
                    content: [{
                        type: "strong",
                        content: [{
                            type: "text",
                            content: "hi"
                        }]
                    }]
                }]
            }]);
        });

        it("should parse multiple bold/italics/underlines", function() {
            var parsed = defaultParse(
                "*some* of this __sentence__ is **bold**"
            );
            validateParse(parsed, [
                {
                    type: "em",
                    content: [{
                        type: "text",
                        content: "some"
                    }]
                },
                {
                    type: "text",
                    content: " of this "
                },
                {
                    type: "u",
                    content: [{
                        type: "text",
                        content: "sentence"
                    }]
                },
                {
                    type: "text",
                    content: " is "
                },
                {
                    type: "strong",
                    content: [{
                        type: "text",
                        content: "bold"
                    }]
                }
            ]);
        });

        it("should parse inline code", function() {
            var parsed = defaultParse("`hi`");
            validateParse(parsed, [{
                type: "inlineCode",
                content: "hi"
            }]);
        });

        it("should parse * and _ inside `` as code", function() {
            var parsed = defaultParse(
                "`const int * const * const p; // _hi_`"
            );
            validateParse(parsed, [{
                type: "inlineCode",
                content: "const int * const * const p; // _hi_"
            }]);
        });

        it("should allow you to escape special characters with \\", function() {
            var parsed = defaultParse(
                "\\`hi\\` \\*bye\\* \\~\\|\\<\\[\\{"
            );
            validateParse(parsed, [
                { type: "text", content: "`" },
                { type: "text", content: "hi" },
                { type: "text", content: "`" },
                { type: "text", content: " " },
                { type: "text", content: "*" },
                { type: "text", content: "bye" },
                { type: "text", content: "*" },
                { type: "text", content: " " },
                { type: "text", content: "~" },
                { type: "text", content: "|" },
                { type: "text", content: "<" },
                { type: "text", content: "[" },
                { type: "text", content: "{" },
            ]);

            var parsed2 = defaultParse(
                "hi\\^caret"
            );
            validateParse(parsed2, [
                { type: "text", content: "hi" },
                { type: "text", content: "^" },
                { type: "text", content: "caret" },
            ]);
        });

        it("should parse basic []() links as links", function() {
            var parsed = defaultParse("[hi](http://www.google.com)");
            validateParse(parsed, [{
                type: "link",
                content: [{
                    type: "text",
                    content: "hi"
                }],
                target: "http://www.google.com",
                title: undefined
            }]);

            var parsed2 = defaultParse("[secure](https://www.google.com)");
            validateParse(parsed2, [{
                type: "link",
                content: [{
                    type: "text",
                    content: "secure"
                }],
                target: "https://www.google.com",
                title: undefined
            }]);

            var parsed3 = defaultParse(
                "[local](http://localhost:9000/test.html)"
            );
            validateParse(parsed3, [{
                type: "link",
                content: [{
                    type: "text",
                    content: "local"
                }],
                target: "http://localhost:9000/test.html",
                title: undefined
            }]);

            var parsed4 = defaultParse(
                "[params](http://localhost:9000/test.html" +
                "?content=%7B%7D&format=pretty)"
            );
            validateParse(parsed4, [{
                type: "link",
                content: [{
                    type: "text",
                    content: "params"
                }],
                target: "http://localhost:9000/test.html" +
                        "?content=%7B%7D&format=pretty",
                title: undefined
            }]);

            var parsed5 = defaultParse(
                "[hash](http://localhost:9000/test.html#content=%7B%7D)"
            );
            validateParse(parsed5, [{
                type: "link",
                content: [{
                    type: "text",
                    content: "hash"
                }],
                target: "http://localhost:9000/test.html#content=%7B%7D",
                title: undefined
            }]);
        });

        it("should allow escaping `[` with `\\`", function() {
            // Without the backslash, the following would be a
            // link with the text "hi".
            // With the backslash, it should ignore the '[hi]'
            // portion, but will still detect that the inside
            // of the parentheses contains a raw url, which it
            // will turn into a url link.
            var parsed = defaultParse("\\[hi](http://www.google.com)");
            validateParse(parsed, [
                {content: "[", type: "text"},
                {content: "hi", type: "text"},
                {content: "]", type: "text"},
                {content: "(", type: "text"},
                {
                    type: "link",
                    content: [{
                        type: "text",
                        content: "http://www.google.com"
                    }],
                    target: "http://www.google.com",
                    title: undefined
                },
                {content: ")", type: "text"},
            ]);
        });

        it("should parse basic <autolinks>", function() {
            var parsed = defaultParse("<http://www.google.com>");
            validateParse(parsed, [{
                type: "link",
                content: [{
                    type: "text",
                    content: "http://www.google.com"
                }],
                target: "http://www.google.com"
            }]);

            var parsed2 = defaultParse("<https://www.google.com>");
            validateParse(parsed2, [{
                type: "link",
                content: [{
                    type: "text",
                    content: "https://www.google.com"
                }],
                target: "https://www.google.com"
            }]);

            var parsed3 = defaultParse("<http://localhost:9000/test.html>");
            validateParse(parsed3, [{
                type: "link",
                content: [{
                    type: "text",
                    content: "http://localhost:9000/test.html"
                }],
                target: "http://localhost:9000/test.html"
            }]);

            var parsed4 = defaultParse(
                "<http://localhost:9000/test.html" +
                "?content=%7B%7D&format=pretty>"
            );
            validateParse(parsed4, [{
                type: "link",
                content: [{
                    type: "text",
                    content: "http://localhost:9000/test.html" +
                            "?content=%7B%7D&format=pretty"
                }],
                target: "http://localhost:9000/test.html" +
                        "?content=%7B%7D&format=pretty"
            }]);

            var parsed5 = defaultParse(
                "<http://localhost:9000/test.html#content=%7B%7D>"
            );
            validateParse(parsed5, [{
                type: "link",
                content: [{
                    type: "text",
                    content: "http://localhost:9000/test.html#content=%7B%7D"
                }],
                target: "http://localhost:9000/test.html#content=%7B%7D"
            }]);
        });

        it("should parse basic <mailto@autolinks>", function() {
            var parsed = defaultParse("<test@example.com>");
            validateParse(parsed, [{
                type: "link",
                content: [{
                    type: "text",
                    content: "test@example.com"
                }],
                target: "mailto:test@example.com"
            }]);

            var parsed2 = defaultParse("<test+ext@example.com>");
            validateParse(parsed2, [{
                type: "link",
                content: [{
                    type: "text",
                    content: "test+ext@example.com"
                }],
                target: "mailto:test+ext@example.com"
            }]);

            var parsed3 = defaultParse("<mailto:test@example.com>");
            validateParse(parsed3, [{
                type: "link",
                content: [{
                    type: "text",
                    content: "mailto:test@example.com"
                }],
                target: "mailto:test@example.com"
            }]);

            var parsed4 = defaultParse("<MAILTO:TEST@EXAMPLE.COM>");
            validateParse(parsed4, [{
                type: "link",
                content: [{
                    type: "text",
                    content: "MAILTO:TEST@EXAMPLE.COM"
                }],
                target: "MAILTO:TEST@EXAMPLE.COM"
            }]);
        });

        it("should parse basic freeform urls", function() {
            var parsed = defaultParse("http://www.google.com");
            validateParse(parsed, [{
                type: "link",
                content: [{
                    type: "text",
                    content: "http://www.google.com"
                }],
                target: "http://www.google.com",
                title: undefined
            }]);

            var parsed2 = defaultParse("https://www.google.com");
            validateParse(parsed2, [{
                type: "link",
                content: [{
                    type: "text",
                    content: "https://www.google.com"
                }],
                target: "https://www.google.com",
                title: undefined
            }]);

            var parsed3 = defaultParse("http://example.com/test.html");
            validateParse(parsed3, [{
                type: "link",
                content: [{
                    type: "text",
                    content: "http://example.com/test.html"
                }],
                target: "http://example.com/test.html",
                title: undefined
            }]);

            var parsed4 = defaultParse(
                "http://example.com/test.html" +
                "?content=%7B%7D&format=pretty"
            );
            validateParse(parsed4, [{
                type: "link",
                content: [{
                    type: "text",
                    content: "http://example.com/test.html" +
                            "?content=%7B%7D&format=pretty"
                }],
                target: "http://example.com/test.html" +
                        "?content=%7B%7D&format=pretty",
                title: undefined
            }]);

            var parsed5 = defaultParse(
                "http://example.com/test.html#content=%7B%7D"
            );
            validateParse(parsed5, [{
                type: "link",
                content: [{
                    type: "text",
                    content: "http://example.com/test.html#content=%7B%7D"
                }],
                target: "http://example.com/test.html#content=%7B%7D",
                title: undefined
            }]);
        });

        it("should parse freeform urls inside paragraphs", function() {
            var parsed = defaultParse(
                "hi this is a link http://www.google.com\n\n"
            );
            validateParse(parsed, [{
                type: "paragraph",
                content: [
                    {
                        type: "text",
                        content: "hi this is a link ",
                    },
                    {
                        type: "link",
                        content: [{
                            type: "text",
                            content: "http://www.google.com"
                        }],
                        target: "http://www.google.com",
                        title: undefined
                    }
                ]
            }]);
        });

        it("should parse [reflinks][and their targets]", function() {
            var parsed = defaultParse(
                "[Google][1]\n\n" +
                "[1]: http://www.google.com\n\n"
            );
            validateParse(parsed, [
                {
                    type: "paragraph",
                    content: [{
                        type: "link",
                        content: [{
                            type: "text",
                            content: "Google"
                        }],
                        target: "http://www.google.com",
                        title: undefined
                    }]
                },
                {
                    type: "def",
                    def: "1",
                    target: "http://www.google.com",
                    title: undefined
                },
            ]);

            var parsed2 = defaultParse(
                "[1]: http://www.google.com\n\n" +
                "[Google][1]\n\n"
            );
            validateParse(parsed2, [
                {
                    type: "def",
                    def: "1",
                    target: "http://www.google.com",
                    title: undefined
                },
                {
                    type: "paragraph",
                    content: [{
                        type: "link",
                        content: [{
                            type: "text",
                            content: "Google"
                        }],
                        target: "http://www.google.com",
                        title: undefined
                    }]
                },
            ]);
        });

        it("should parse inline link titles", function() {
            var parsed = defaultParse(
                "[Google](http://www.google.com \"This is google!\")"
            );
            validateParse(parsed, [{
                type: "link",
                content: [{
                    type: "text",
                    content: "Google"
                }],
                target: "http://www.google.com",
                title: "This is google!"
            }]);

            var parsed2 = defaultParse(
                "[Google](http://www.google.com \"still Google\")"
            );
            validateParse(parsed2, [{
                type: "link",
                content: [{
                    type: "text",
                    content: "Google"
                }],
                target: "http://www.google.com",
                title: "still Google"
            }]);
        });

        it("should parse reflink titles", function() {
            var parsed = defaultParse(
                "[Google][1]\n\n" +
                "[1]: http://www.google.com (This is google!)\n\n"
            );
            validateParse(parsed, [
                {
                    type: "paragraph",
                    content: [{
                        type: "link",
                        content: [{
                            type: "text",
                            content: "Google"
                        }],
                        target: "http://www.google.com",
                        title: "This is google!"
                    }]
                },
                {
                    type: "def",
                    def: "1",
                    target: "http://www.google.com",
                    title: "This is google!"
                },
            ]);

            var parsed2 = defaultParse(
                "[1]: http://www.google.com \"still Google\"\n\n" +
                "[Google][1]\n\n"
            );
            validateParse(parsed2, [
                {
                    type: "def",
                    def: "1",
                    target: "http://www.google.com",
                    title: "still Google"
                },
                {
                    type: "paragraph",
                    content: [{
                        type: "link",
                        content: [{
                            type: "text",
                            content: "Google"
                        }],
                        target: "http://www.google.com",
                        title: "still Google"
                    }]
                },
            ]);

            // test some edge cases, notably:
            // target of ""; title using parens; def with a `-` in it
            var parsed3 = defaultParse(
                "[Nowhere][nowhere-target]\n\n" +
                "[nowhere-target]: <> (nowhere)\n\n"
            );
            validateParse(parsed3, [
                {
                    type: "paragraph",
                    content: [{
                        type: "link",
                        content: [{
                            type: "text",
                            content: "Nowhere"
                        }],
                        target: "",
                        title: "nowhere"
                    }]
                },
                {
                    type: "def",
                    def: "nowhere-target",
                    target: "",
                    title: "nowhere"
                },
            ]);
        });

        it("should parse [reflinks][] with implicit targets", function() {
            var parsed = defaultParse(
                "[Google][]\n\n" +
                "[Google]: http://www.google.com\n\n"
            );
            validateParse(parsed, [
                {
                    type: "paragraph",
                    content: [{
                        type: "link",
                        content: [{
                            type: "text",
                            content: "Google"
                        }],
                        target: "http://www.google.com",
                        title: undefined
                    }]
                },
                {
                    type: "def",
                    def: "google",
                    target: "http://www.google.com",
                    title: undefined
                },
            ]);

            var parsed2 = defaultParse(
                "[Google]: http://www.google.com\n\n" +
                "[Google][]\n\n"
            );
            validateParse(parsed2, [
                {
                    type: "def",
                    def: "google",
                    target: "http://www.google.com",
                    title: undefined
                },
                {
                    type: "paragraph",
                    content: [{
                        type: "link",
                        content: [{
                            type: "text",
                            content: "Google"
                        }],
                        target: "http://www.google.com",
                        title: undefined
                    }]
                },
            ]);
        });

        it("should handle multiple [reflinks][to the same target]", function() {
            var parsed = defaultParse(
                "[Google][1] [Yahoo][1]\n\n" +
                "[1]: http://www.google.com\n\n"
            );
            validateParse(parsed, [
                {
                    type: "paragraph",
                    content: [
                        {
                            type: "link",
                            content: [{
                                type: "text",
                                content: "Google"
                            }],
                            target: "http://www.google.com",
                            title: undefined
                        },
                        {
                            type: "text",
                            content: " "
                        },
                        {
                            type: "link",
                            content: [{
                                type: "text",
                                content: "Yahoo"
                            }],
                            target: "http://www.google.com",
                            title: undefined
                        },
                    ]
                },
                {
                    type: "def",
                    def: "1",
                    target: "http://www.google.com",
                    title: undefined
                },
            ]);

            // This is sort of silly, but the last def overrides all previous
            // links. This is just a test that things are continuing to work
            // as we currently expect them to, but I seriously hope no one
            // writes markdown like this!
            var parsed2 = defaultParse(
                "[test][1]\n\n" +
                "[1]: http://google.com\n\n" +
                "[test2][1]\n\n" +
                "[1]: http://khanacademy.org\n\n"
            );
            validateParse(parsed2, [
                {
                    type: "paragraph",
                    content: [{
                        type: "link",
                        content: [{
                            type: "text",
                            content: "test"
                        }],
                        target: "http://khanacademy.org",
                        title: undefined
                    }]
                },
                {
                    type: "def",
                    def: "1",
                    target: "http://google.com",
                    title: undefined
                },
                {
                    type: "paragraph",
                    content: [{
                        type: "link",
                        content: [{
                            type: "text",
                            content: "test2"
                        }],
                        target: "http://khanacademy.org",
                        title: undefined
                    }]
                },
                {
                    type: "def",
                    def: "1",
                    target: "http://khanacademy.org",
                    title: undefined
                },
            ]);
        });

        it("should parse basic images", function() {
            var parsed = defaultParse("![](http://example.com/test.png)");
            validateParse(parsed, [{
                type: "image",
                alt: "",
                target: "http://example.com/test.png",
                title: undefined
            }]);

            var parsed2 = defaultParse("![aaalt](http://example.com/image)");
            validateParse(parsed2, [{
                type: "image",
                alt: "aaalt",
                target: "http://example.com/image",
                title: undefined
            }]);

            var parsed3 = defaultParse(
                "![](http://localhost:9000/test.html \"local\")"
            );
            validateParse(parsed3, [{
                type: "image",
                alt: "",
                target: "http://localhost:9000/test.html",
                title: "local"
            }]);

            var parsed4 = defaultParse(
                "![p](http://localhost:9000/test" +
                "?content=%7B%7D&format=pretty \"params\")"
            );
            validateParse(parsed4, [{
                type: "image",
                alt: "p",
                target: "http://localhost:9000/test" +
                        "?content=%7B%7D&format=pretty",
                title: "params"
            }]);

            var parsed5 = defaultParse(
                "![hash](http://localhost:9000/test.png#content=%7B%7D)"
            );
            validateParse(parsed5, [{
                type: "image",
                alt: "hash",
                target: "http://localhost:9000/test.png#content=%7B%7D",
                title: undefined
            }]);
        });

        it("should parse [refimages][and their targets]", function() {
            var parsed = defaultParse(
                "![aaalt][1]\n\n" +
                "[1]: http://example.com/test.gif\n\n"
            );
            validateParse(parsed, [
                {
                    type: "paragraph",
                    content: [{
                        type: "image",
                        alt: "aaalt",
                        target: "http://example.com/test.gif",
                        title: undefined
                    }]
                },
                {
                    type: "def",
                    def: "1",
                    target: "http://example.com/test.gif",
                    title: undefined
                },
            ]);

            var parsed2 = defaultParse(
                "[image]: http://example.com/test.gif\n\n" +
                "![image][]\n\n"
            );
            validateParse(parsed2, [
                {
                    type: "def",
                    def: "image",
                    target: "http://example.com/test.gif",
                    title: undefined
                },
                {
                    type: "paragraph",
                    content: [{
                        type: "image",
                        alt: "image",
                        target: "http://example.com/test.gif",
                        title: undefined
                    }]
                },
            ]);

            var parsed3 = defaultParse(
                "[image]: http://example.com/test.gif \"title!\"\n\n" +
                "![image][]\n\n"
            );
            validateParse(parsed3, [
                {
                    type: "def",
                    def: "image",
                    target: "http://example.com/test.gif",
                    title: "title!"
                },
                {
                    type: "paragraph",
                    content: [{
                        type: "image",
                        alt: "image",
                        target: "http://example.com/test.gif",
                        title: "title!"
                    }]
                },
            ]);

            var parsed3 = defaultParse(
                "[image]: http://example.com/test.gif (*title text*)\n\n" +
                "![image][]\n\n"
            );
            validateParse(parsed3, [
                {
                    type: "def",
                    def: "image",
                    target: "http://example.com/test.gif",
                    title: "*title text*"
                },
                {
                    type: "paragraph",
                    content: [{
                        type: "image",
                        alt: "image",
                        target: "http://example.com/test.gif",
                        title: "*title text*"
                    }]
                },
            ]);
        });

        it("should compare defs case- and whitespace-insensitively", function() {
            var parsed = defaultParse(
                "[Google][HiIiI]\n\n" +
                "[HIiii]: http://www.google.com\n\n"
            );
            validateParse(parsed, [
                {
                    type: "paragraph",
                    content: [{
                        type: "link",
                        content: [{
                            type: "text",
                            content: "Google"
                        }],
                        target: "http://www.google.com",
                        title: undefined
                    }]
                },
                {
                    type: "def",
                    def: "hiiii",
                    target: "http://www.google.com",
                    title: undefined
                },
            ]);

            var parsed2 = defaultParse(
                "[Google][]\n\n" +
                "[google]: http://www.google.com\n\n"
            );
            validateParse(parsed2, [
                {
                    type: "paragraph",
                    content: [{
                        type: "link",
                        content: [{
                            type: "text",
                            content: "Google"
                        }],
                        target: "http://www.google.com",
                        title: undefined
                    }]
                },
                {
                    type: "def",
                    def: "google",
                    target: "http://www.google.com",
                    title: undefined
                },
            ]);

            var parsed3 = defaultParse(
                "[Google][ h    i ]\n\n" +
                "[  h i   ]: http://www.google.com\n\n"
            );
            validateParse(parsed3, [
                {
                    type: "paragraph",
                    content: [{
                        type: "link",
                        content: [{
                            type: "text",
                            content: "Google"
                        }],
                        target: "http://www.google.com",
                        title: undefined
                    }]
                },
                {
                    type: "def",
                    def: " h i ",
                    target: "http://www.google.com",
                    title: undefined
                },
            ]);
        });

        it("should not allow defs to break out of a paragraph", function() {
            var parsed = defaultParse("hi [1]: there\n\n");
            validateParse(parsed, [{
                type: "paragraph",
                content: [
                    {content: "hi ", type: "text"},
                    {content: "[1", type: "text"},
                    {content: "]", type: "text"},
                    {content: ": there", type: "text"},
                ]
            }]);
        });

        it("should allow a group of defs next to each other", function() {
            var parsed = defaultParse(
                "[a]: # (title)\n" +
                "[b]: http://www.google.com\n" +
                "[//]: <> (hi)\n" +
                "[label]: # (there)\n" +
                "[#]: #\n" +
                "\n"
            );
            validateParse(parsed, [
                {
                    type: "def",
                    def: "a",
                    target: "#",
                    title: "title"
                },
                {
                    type: "def",
                    def: "b",
                    target: "http://www.google.com",
                    title: undefined
                },
                {
                    type: "def",
                    def: "//",
                    target: "",
                    title: "hi"
                },
                {
                    type: "def",
                    def: "label",
                    target: "#",
                    title: "there"
                },
                {
                    type: "def",
                    def: "#",
                    target: "#",
                    title: undefined
                },
            ]);
        });

        it("should parse a single top-level paragraph", function() {
            var parsed = defaultParse("hi\n\n");
            validateParse(parsed, [{
                type: "paragraph",
                content: [{
                    type: "text",
                    content: "hi"
                }]
            }]);
        });

        it("should parse multiple top-level paragraphs", function() {
            var parsed = defaultParse("hi\n\nbye\n\nthere\n\n");
            validateParse(parsed, [
                {
                    type: "paragraph",
                    content: [{
                        type: "text",
                        content: "hi"
                    }]
                },
                {
                    type: "paragraph",
                    content: [{
                        type: "text",
                        content: "bye"
                    }]
                },
                {
                    type: "paragraph",
                    content: [{
                        type: "text",
                        content: "there"
                    }]
                },
            ]);
        });

        it("should not parse single newlines as paragraphs", function() {
            var parsed = defaultParse("hi\nbye\nthere\n");
            validateParse(parsed, [{
                type: "text",
                content: "hi\nbye\nthere\n"
            }]);
        });

        it("should not parse a single newline as a new paragraph", function() {
            var parsed = defaultParse("hi\nbye\nthere\n\n");
            validateParse(parsed, [{
                type: "paragraph",
                content: [{
                    type: "text",
                    content: "hi\nbye\nthere"
                }]
            }]);
        });

        it("should allow whitespace-only lines to end paragraphs", function() {
            var parsed = defaultParse("hi\n \n");
            validateParse(parsed, [{
                type: "paragraph",
                content: [{
                    type: "text",
                    content: "hi"
                }]
            }]);

            var parsed2 = defaultParse("hi\n  \n");
            validateParse(parsed2, [{
                type: "paragraph",
                content: [{
                    type: "text",
                    content: "hi"
                }]
            }]);

            var parsed3 = defaultParse("hi\n\n  \n  \n");
            validateParse(parsed3, [{
                type: "paragraph",
                content: [{
                    type: "text",
                    content: "hi"
                }]
            }]);

            var parsed4 = defaultParse("hi\n  \n\n   \nbye\n\n");
            validateParse(parsed4, [
                {
                    type: "paragraph",
                    content: [{
                        type: "text",
                        content: "hi"
                    }]
                },
                {
                    type: "paragraph",
                    content: [{
                        type: "text",
                        content: "bye"
                    }]
                },
            ]);
        });

        it("should parse a single heading", function() {
            var parsed = defaultParse("### heading3\n\n");
            validateParse(parsed, [{
                type: "heading",
                level: 3,
                content: [{
                    type: "text",
                    content: "heading3"
                }]
            }]);
        });

        it("should parse a single lheading", function() {
            var parsed = defaultParse("heading2\n-----\n\n");
            validateParse(parsed, [{
                type: "heading",
                level: 2,
                content: [{
                    type: "text",
                    content: "heading2"
                }]
            }]);
        });

        it("should not parse a single lheading with two -- or ==", function() {
            var parsed = defaultParse("heading1\n==\n\n");
            validateParse(parsed, [{
                type: "paragraph",
                content: [
                    {type: "text", content: "heading1\n"},
                    {type: "text", content: "="},
                    {type: "text", content: "="},
                ]
            }]);

            var parsed2 = defaultParse("heading2\n--\n\n");
            validateParse(parsed2, [{
                type: "paragraph",
                content: [
                    {type: "text", content: "heading2\n"},
                    {type: "text", content: "--"},
                ]
            }]);
        });

        it("should not parse 7 #s as an h7", function() {
            var parsed = defaultParse("#######heading7\n\n");
            validateParse(parsed, [{
                type: "heading",
                level: 6,
                content: [{
                    type: "text",
                    content: "#heading7"
                }]
            }]);
        });

        it("should parse a heading between paragraphs", function() {
            var parsed = defaultParse(
                "para 1\n\n" +
                "#heading\n\n\n" +
                "para 2\n\n"
            );
            validateParse(parsed, [
                {
                    type: "paragraph",
                    content: [{
                        type: "text",
                        content: "para 1"
                    }]
                },
                {
                    type: "heading",
                    level: 1,
                    content: [{
                        type: "text",
                        content: "heading"
                    }]
                },
                {
                    type: "paragraph",
                    content: [{
                        type: "text",
                        content: "para 2"
                    }]
                },
            ]);
        });

        it("should not allow headings mid-paragraph", function() {
            var parsed = defaultParse(
                "paragraph # text\n" +
                "more paragraph\n\n"
            );
            validateParse(parsed, [{
                type: "paragraph",
                content: [
                    {content: "paragraph ", type: "text"},
                    {content: "# text\nmore paragraph", type: "text"},
                ]
            }]);

            var parsed2 = defaultParse(
                "paragraph\n" +
                "text\n" +
                "----\n" +
                "more paragraph\n\n"
            );
            validateParse(parsed2, [{
                type: "paragraph",
                content: [
                    {content: "paragraph\ntext\n", type: "text"},
                    {content: "-", type: "text"},
                    {content: "-", type: "text"},
                    {content: "--\nmore paragraph", type: "text"},
                ]
            }]);
        });

        it("should parse a single top-level blockquote", function() {
            var parsed = defaultParse("> blockquote\n\n");
            validateParse(parsed, [{
                type: "blockQuote",
                content: [{
                    type: "paragraph",
                    content: [{
                        type: "text",
                        content: "blockquote"
                    }],
                }]
            }]);
        });

        it("should parse multiple blockquotes and paragraphs", function() {
            var parsed = defaultParse(
                "para 1\n\n" +
                "> blockquote 1\n" +
                ">\n" +
                ">blockquote 2\n\n" +
                "para 2\n\n"
            );
            validateParse(parsed, [
                {
                    type: "paragraph",
                    content: [{
                        type: "text",
                        content: "para 1"
                    }],
                },
                {
                    type: "blockQuote",
                    content: [
                        {
                            type: "paragraph",
                            content: [{
                                type: "text",
                                content: "blockquote 1"
                            }],
                        },
                        {
                            type: "paragraph",
                            content: [{
                                type: "text",
                                content: "blockquote 2"
                            }],
                        }
                    ]
                },
                {
                    type: "paragraph",
                    content: [{
                        type: "text",
                        content: "para 2"
                    }],
                },
            ]);
        });

        it("should not let a > escape a paragraph as a blockquote", function() {
            var parsed = defaultParse(
                "para 1 > not a quote\n\n"
            );
            validateParse(parsed, [{
                type: "paragraph",
                content: [
                    {content: "para 1 ", type: "text"},
                    {content: "> not a quote", type: "text"},
                ]
            }]);
        });

        it("should parse a single top-level code block", function() {
            var parsed = defaultParse("    if (true) { code(); }\n\n");
            validateParse(parsed, [{
                type: "codeBlock",
                lang: undefined,
                content: "if (true) { code(); }"
            }]);
        });

        it("should parse a code block with trailing spaces", function() {
            var parsed = defaultParse("    if (true) { code(); }\n    \n\n");
            validateParse(parsed, [{
                type: "codeBlock",
                lang: undefined,
                content: "if (true) { code(); }"
            }]);
        });

        it("should parse fence blocks", function() {
            var parsed = defaultParse("```\ncode\n```\n\n");
            validateParse(parsed, [{
                type: "codeBlock",
                lang: undefined,
                content: "code"
            }]);

            var parsed2 = defaultParse(
                "```aletheia\n" +
                "if true [code()]\n" +
                "```\n\n"
            );
            validateParse(parsed2, [{
                type: "codeBlock",
                lang: "aletheia",
                content: "if true [code()]"
            }]);
        });

        it("should parse mixed paragraphs and code", function() {
            var parsed = defaultParse(
                "this is regular text\n\n" +
                "    this is code\n\n" +
                "this is more regular text\n\n");
            validateParse(parsed, [
                {
                    type: "paragraph",
                    content: [{
                        type: "text",
                        content: "this is regular text"
                    }]
                },
                {
                    type: "codeBlock",
                    lang: undefined,
                    content: "this is code"
                },
                {
                    type: "paragraph",
                    content: [{
                        type: "text",
                        content: "this is more regular text"
                    }]
                },
            ]);
        });

        it("should parse top-level horizontal rules", function() {
            var parsed = defaultParse(
                "---\n\n" +
                "***\n\n" +
                "___\n\n" +
                " - - - - \n\n" +
                "_ _ _\n\n" +
                "  ***  \n\n"
            );
            validateParse(parsed, [
                { type: "hr" },
                { type: "hr" },
                { type: "hr" },
                { type: "hr" },
                { type: "hr" },
                { type: "hr" },
            ]);
        });

        it("should parse hrs between paragraphs", function() {
            var parsed = defaultParse(
                "para 1\n\n" +
                " * * * \n\n" +
                "para 2\n\n");
            validateParse(parsed, [
                {
                    type: "paragraph",
                    content: [{
                        type: "text",
                        content: "para 1"
                    }]
                },
                { type: "hr" },
                {
                    type: "paragraph",
                    content: [{
                        type: "text",
                        content: "para 2"
                    }]
                },
            ]);
        });

        it("should not allow hrs within a paragraph", function() {
            var parsed = defaultParse(
                "paragraph ----\n" +
                "more paragraph\n\n"
            );
            validateParse(parsed, [{
                type: "paragraph",
                content: [
                    {content: "paragraph ", type: "text"},
                    {content: "-", type: "text"},
                    {content: "-", type: "text"},
                    {content: "--\nmore paragraph", type: "text"},
                ]
            }]);
        });

        it("should parse simple unordered lists", function() {
            var parsed = defaultParse(
                " * hi\n" +
                " * bye\n" +
                " * there\n\n"
            );
            validateParse(parsed, [{
                ordered: false,
                start: undefined,
                items: [
                    [{
                        content: "hi\n",
                        type: "text",
                    }],
                    [{
                        content: "bye\n",
                        type: "text",
                    }],
                    [{
                        content: "there\n",
                        type: "text",
                    }],
                ],
                type: "list",
            }]);
        });

        it("should parse simple ordered lists", function() {
            var parsed = defaultParse(
                "1. first\n" +
                "2. second\n" +
                "3. third\n\n"
            );
            validateParse(parsed, [{
                type: "list",
                ordered: true,
                start: 1,
                items: [
                    [{
                        type: "text",
                        content: "first\n",
                    }],
                    [{
                        type: "text",
                        content: "second\n",
                    }],
                    [{
                        type: "text",
                        content: "third\n",
                    }],
                ]
            }]);
        });

        it("should parse simple ordered lists with silly numbers", function() {
            var parsed = defaultParse(
                "1. first\n" +
                "13. second\n" +
                "9. third\n\n"
            );
            validateParse(parsed, [{
                type: "list",
                start: 1,
                ordered: true,
                items: [
                    [{
                        type: "text",
                        content: "first\n",
                    }],
                    [{
                        type: "text",
                        content: "second\n",
                    }],
                    [{
                        type: "text",
                        content: "third\n",
                    }],
                ]
            }]);

            var parsed2 = defaultParse(
                "63. first\n" +
                "13. second\n" +
                "9. third\n\n"
            );
            validateParse(parsed2, [{
                type: "list",
                start: 63,
                ordered: true,
                items: [
                    [{
                        type: "text",
                        content: "first\n",
                    }],
                    [{
                        type: "text",
                        content: "second\n",
                    }],
                    [{
                        type: "text",
                        content: "third\n",
                    }],
                ]
            }]);
        });

        it("should parse nested lists", function() {
            var parsed = defaultParse(
                "1. first\n" +
                "2. second\n" +
                "   * inner\n" +
                "   * inner\n" +
                "3. third\n\n"
            );
            validateParse(parsed, [{
                ordered: true,
                start: 1,
                items: [
                    [{
                        content: "first\n",
                        type: "text",
                    }],
                    [
                        {
                            content: "second\n",
                            type: "text",
                        },
                        {
                            ordered: false,
                            start: undefined,
                            items: [
                                [{
                                    content: "inner\n",
                                    type: "text",
                                }],
                                [{
                                    content: "inner\n",
                                    type: "text",
                                }]
                            ],
                            type: "list",
                        }
                    ],
                    [{
                        content: "third\n",
                        type: "text",
                    }],
                ],
                type: "list",
            }]);
        });

        it("should parse loose lists", function() {
            var parsed = defaultParse(
                " * hi\n\n" +
                " * bye\n\n" +
                " * there\n\n"
            );
            validateParse(parsed, [{
                type: "list",
                ordered: false,
                start: undefined,
                items: [
                    [{
                        type: "paragraph",
                        content: [{
                            type: "text",
                            content: "hi"
                        }]
                    }],
                    [{
                        type: "paragraph",
                        content: [{
                            type: "text",
                            content: "bye"
                        }]
                    }],
                    [{
                        type: "paragraph",
                        content: [{
                            type: "text",
                            content: "there"
                        }]
                    }],
                ]
            }]);
        });

        it("should have defined behaviour for semi-loose lists", function() {
            // we mostly care that this does something vaguely reasonable.
            // if you write markdown like this the results are your own fault.
            var parsed = defaultParse(
                " * hi\n" +
                " * bye\n\n" +
                " * there\n\n"
            );
            validateParse(parsed, [{
                type: "list",
                ordered: false,
                start: undefined,
                items: [
                    [{
                        type: "text",
                        content: "hi\n"
                    }],
                    [{
                        type: "paragraph",
                        content: [{
                            type: "text",
                            content: "bye"
                        }]
                    }],
                    [{
                        type: "paragraph",
                        content: [{
                            type: "text",
                            content: "there"
                        }]
                    }],
                ]
            }]);

            var parsed2 = defaultParse(
                " * hi\n\n" +
                " * bye\n" +
                " * there\n\n"
            );
            validateParse(parsed2, [{
                type: "list",
                ordered: false,
                start: undefined,
                items: [
                    [{
                        type: "paragraph",
                        content: [{
                            type: "text",
                            content: "hi"
                        }]
                    }],
                    [{
                        type: "text",
                        content: "bye\n"
                    }],
                    [{
                        type: "text",
                        content: "there\n"
                    }],
                ]
            }]);
        });

        it("should parse paragraphs within loose lists", function() {
            var parsed = defaultParse(
                " * hi\n\n" +
                "   hello\n\n" +
                " * bye\n\n" +
                " * there\n\n"
            );
            validateParse(parsed, [{
                type: "list",
                ordered: false,
                start: undefined,
                items: [
                    [
                        {
                            type: "paragraph",
                            content: [{
                                type: "text",
                                content: "hi"
                            }]
                        },
                        {
                            type: "paragraph",
                            content: [{
                                type: "text",
                                content: "hello"
                            }]
                        },
                    ],
                    [{
                        type: "paragraph",
                        content: [{
                            type: "text",
                            content: "bye"
                        }]
                    }],
                    [{
                        type: "paragraph",
                        content: [{
                            type: "text",
                            content: "there"
                        }]
                    }],
                ]
            }]);
        });

        it("should allow line breaks+wrapping in tight lists", function() {
            var parsed = defaultParse(
                " * hi\n" +
                "   hello\n\n" +
                " * bye\n\n" +
                " * there\n\n"
            );
            validateParse(parsed, [{
                type: "list",
                ordered: false,
                start: undefined,
                items: [
                    [{
                        type: "paragraph",
                        content: [{
                            type: "text",
                            content: "hi\nhello"
                        }]
                    }],
                    [{
                        type: "paragraph",
                        content: [{
                            type: "text",
                            content: "bye"
                        }]
                    }],
                    [{
                        type: "paragraph",
                        content: [{
                            type: "text",
                            content: "there"
                        }]
                    }],
                ]
            }]);
        });

        it("should allow code inside list items", function() {
            var parsed = defaultParse(
                " * this is a list\n\n" +
                "       with code in it\n\n"
            );
            validateParse(parsed, [{
                type: "list",
                ordered: false,
                start: undefined,
                items: [[
                    {
                        type: "paragraph",
                        content: [{
                            type: "text",
                            content: "this is a list"
                        }]
                    },
                    {
                        type: "codeBlock",
                        lang: undefined,
                        content: "with code in it"
                    }
                ]]
            }]);

            var parsed2 = defaultParse(
                " * this is a list\n\n" +
                "       with code in it\n\n" +
                " * second item\n" +
                "\n"
            );
            validateParse(parsed2, [{
                type: "list",
                ordered: false,
                start: undefined,
                items: [
                    [
                        {
                            type: "paragraph",
                            content: [{
                                type: "text",
                                content: "this is a list"
                            }]
                        },
                        {
                            type: "codeBlock",
                            lang: undefined,
                            content: "with code in it"
                        }
                    ],
                    [
                        {
                            type: "paragraph",
                            content: [{
                                type: "text",
                                content: "second item"
                            }]
                        },
                    ],
                ]
            }]);
        });

        it("should allow lists inside blockquotes", function() {
            // This list also has lots of trailing space after the *s
            var parsed = defaultParse(
                "> A list within a blockquote\n" +
                ">\n" +
                "> *    asterisk 1\n" +
                "> *    asterisk 2\n" +
                "> *    asterisk 3\n" +
                "\n"
            );
            validateParse(parsed, [{
                type: "blockQuote",
                content: [
                    {
                        type: "paragraph",
                        content: [{
                            content: "A list within a blockquote",
                            type: "text",
                        }]
                    },
                    {

                        type: "list",
                        ordered: false,
                        start: undefined,
                        items: [
                            [{
                                content: "asterisk 1\n",
                                type: "text",
                            }],
                            [{
                                content: "asterisk 2\n",
                                type: "text",
                            }],
                            [{
                                content: "asterisk 3\n",
                                type: "text",
                            }],
                        ]
                    }
                ]
            }]);
        });

        it("symbols should not break a paragraph into a list", function() {
            var parsed = defaultParse("hi - there\n\n");
            validateParse(parsed, [{
                type: "paragraph",
                content: [
                    { content: "hi - there", type: "text" },
                ]
            }]);

            var parsed2 = defaultParse("hi * there\n\n");
            validateParse(parsed2, [{
                type: "paragraph",
                content: [
                    { content: "hi ", type: "text" },
                    { content: "* there", type: "text" },
                ]
            }]);

            var parsed3 = defaultParse("hi 1. there\n\n");
            validateParse(parsed3, [{
                type: "paragraph",
                content: [
                    { content: "hi 1", type: "text" },
                    { content: ". there", type: "text" },
                ]
            }]);
        });

        it("dashes or numbers should not break a list item into a list", function() {
            var parsed = defaultParse("- hi - there\n\n");
            validateParse(parsed, [{
                type: "list",
                ordered: false,
                start: undefined,
                items: [[
                    { content: "hi - there\n", type: "text" },
                ]]
            }]);

            // NOTE: This doesn't work right now because we need `*`s for
            // emphasis, so we have to split text on them.
            // TODO(aria): split block vs inline parsing so we can handle
            // this case
//            var parsed2 = defaultParse("* hi * there\n\n");
//            validateParse(parsed2, [{
//                type: "list",
//                ordered: false,
//                start: undefined,
//                items: [[
//                    { content: "hi * there\n", type: "text" },
//                ]]
//            }]);

            var parsed3 = defaultParse("1. hi 1. there\n\n");
            validateParse(parsed3, [{
                type: "list",
                ordered: true,
                start: 1,
                items: [[
                    { content: "hi 1", type: "text" },
                    { content: ". there\n", type: "text" },
                ]]
            }]);
        });

        it("should ignore double spaces at the end of lists", function() {
            var parsed = defaultParse(" * hi  \n * there\n\n");
            validateParse(parsed, [{
                type: "list",
                ordered: false,
                start: undefined,
                items: [
                    [{type: "text", content: "hi\n"}],
                    [{type: "text", content: "there\n"}],
                ]
            }]);
        });

        it("should parse very simple tables", function() {
            var expected = [{
                type: "table",
                header: [
                    [{type: "text", content: "h1"}],
                    [{type: "text", content: "h2"}],
                    [{type: "text", content: "h3"}]
                ],
                align: [null, null, null],
                cells: [
                    [
                        [{type: "text", content: "d1"}],
                        [{type: "text", content: "d2"}],
                        [{type: "text", content: "d3"}]
                    ],
                    [
                        [{type: "text", content: "e1"}],
                        [{type: "text", content: "e2"}],
                        [{type: "text", content: "e3"}]
                    ]
                ]
            }];

            var parsedPiped = defaultParse(
                "| h1 | h2 | h3 |\n" +
                "| -- | -- | -- |\n" +
                "| d1 | d2 | d3 |\n" +
                "| e1 | e2 | e3 |\n" +
                "\n"
            );
            validateParse(parsedPiped, expected);

            var parsedNp = defaultParse(
                "h1 | h2 | h3\n" +
                "- | - | -\n" +
                "d1 | d2 | d3\n" +
                "e1 | e2 | e3\n" +
                "\n"
            );
            validateParse(parsedNp, expected);
        });

        it("should parse inside table contents", function() {
            var expected = [{
                type: "table",
                header: [
                    [{type: "em", content: [{type: "text", content: "h1"}]}],
                    [{type: "em", content: [{type: "text", content: "h2"}]}],
                    [{type: "em", content: [{type: "text", content: "h3"}]}],
                ],
                align: [null, null, null],
                cells: [[
                    [{type: "em", content: [{type: "text", content: "d1"}]}],
                    [{type: "em", content: [{type: "text", content: "d2"}]}],
                    [{type: "em", content: [{type: "text", content: "d3"}]}],
                ]]
            }];

            var parsedPiped = defaultParse(
                "| *h1* | *h2* | *h3* |\n" +
                "| ---- | ---- | ---- |\n" +
                "| *d1* | *d2* | *d3* |\n" +
                "\n"
            );
            validateParse(parsedPiped, expected);

            var parsedNp = defaultParse(
                "*h1* | *h2* | *h3*\n" +
                "-|-|-\n" +
                "*d1* | *d2* | *d3*\n" +
                "\n"
            );
            validateParse(parsedNp, expected);
        });

        it("should parse table alignments", function() {
            var validateAligns = function(tableSrc, expectedAligns) {
                var parsed = defaultParse(tableSrc + "\n");
                assert.strictEqual(parsed[0].type, "table");
                var actualAligns = parsed[0].align;
                validateParse(actualAligns, expectedAligns);
            };

            validateAligns(
                "| h1 | h2 | h3 |\n" +
                "| -- | -- | -- |\n" +
                "| d1 | d2 | d3 |\n",
                [null, null, null]
            );

            validateAligns(
                "| h1 | h2 | h3 |\n" +
                "|:--:|:-: | :-: |\n" +
                "| d1 | d2 | d3 |\n",
                ["center", "center", "center"]
            );

            validateAligns(
                "| h1 | h2 | h3 |\n" +
                "| :- |:---| :--|\n" +
                "| d1 | d2 | d3 |\n",
                ["left", "left", "left"]
            );

            validateAligns(
                "| h1 | h2 | h3 |\n" +
                "| -: |-:  |  -:|\n" +
                "| d1 | d2 | d3 |\n",
                ["right", "right", "right"]
            );

            validateAligns(
                "h1 | h2 | h3\n" +
                ":-|:-:|-:\n" +
                "d1 | d2 | d3\n",
                ["left", "center", "right"]
            );

            validateAligns(
                "h1 | h2 | h3\n" +
                " :---:  |:--|    --:\n" +
                "d1 | d2 | d3\n",
                ["center", "left", "right"]
            );
        });

        it("should be able to parse <br>s", function() {
            // Inside a paragraph:
            var parsed = defaultParse("hi  \nbye\n\n");
            validateParse(parsed, [{
                type: "paragraph",
                content: [
                    { content: "hi", type: "text" },
                    { type: "br" },
                    { content: "bye", type: "text" },
                ]
            }]);

            // Outside a paragraph:
            var parsed2 = defaultParse("hi  \nbye");
            validateParse(parsed2, [
                { content: "hi", type: "text" },
                { type: "br" },
                { content: "bye", type: "text" },
            ]);

            // But double spaces on the same line shouldn't count:
            var parsed3 = defaultParse("hi  bye");
            validateParse(parsed3, [
                { content: "hi  bye", type: "text" },
            ]);
        });
    });

    describe("react output", function() {
        it("should sanitize dangerous links", function() {
            var html = htmlFromMarkdown(
                "[link](javascript:alert%28%27hi%27%29)"
            );
            assert.strictEqual(html, "<a>link</a>");

            var html2 = htmlFromMarkdown(
                "[link][1]\n\n" +
                "[1]: javascript:alert('hi');\n\n"
            );
            assert.strictEqual(
                html2,
                "<div class=\"paragraph\"><a>link</a></div>"
            );
        });

        it("should not sanitize safe links", function() {
            var html = htmlFromMarkdown(
                "[link](https://www.google.com)"
            );
            assert.strictEqual(
                html,
                "<a href=\"https://www.google.com\">link</a>"
            );

            var html2 = htmlFromMarkdown(
                "[link][1]\n\n" +
                "[1]: https://www.google.com\n\n"
            );
            assert.strictEqual(
                html2,
                "<div class=\"paragraph\">" +
                    "<a href=\"https://www.google.com\">link</a>" +
                "</div>"
            );
        });
    });
});
