// JSON Viewer Module
const JSONViewer = (function() {
    "use strict";

    // Constants
    const EVENT_KEYUP = "keyup";
    const EVENT_CLICK = "click";
    const FAVICON_BASE_PATH = "favicon/";

    // DOM Elements
    const $status = document.getElementById("status");
    const $head = document.querySelector("head");
    const $result = document.getElementById("result");
    const $editor = document.getElementById("editor");

    // Helper Functions
    const typeOf = (variable) => typeof eval(variable);
    const trim = (s) => s.replace(/^\s+|\s+$/g, "");
    const ltrim = (s) => s.replace(/^\s+/g, "");
    const rtrim = (s) => s.replace(/\s+$/g, "");

    // UI Functions
    const setupUIOptions = () => {
        const nodes = document.querySelectorAll(".ui-option");
        nodes.forEach(node => {
            node.addEventListener(EVENT_CLICK, function() {
                document.querySelector("body").classList.toggle(this.id);
            });
        });
    };

    const setupResultToggle = () => {
        $result.addEventListener(EVENT_CLICK, (ev) => {
            const clickedElement = ev.target;
            if (clickedElement.classList.contains("toggle") || clickedElement.classList.contains("toggle-end")) {
                clickedElement.parentNode.classList.toggle("collapsed");
            }
        });
    };

    const setupResizer = () => {
        let startX, startY, startWidth, startHeight, startHeight2;
        const resizableElement = document.querySelector(".ui-editor");
        const resizableElement2 = document.querySelector(".ui-aside");
        const resizer = document.querySelector(".ui-resizer");

        const doDrag = (e) => {
            if (window.getComputedStyle(resizer).height === "1px") {
                let y = startHeight + e.clientY - startY;
                y = Math.max(y, 5);
                resizableElement.style.width = "";
                resizableElement.style.height = `${y}px`;
                resizableElement2.style.height = `${startHeight2 - y}px`;
            } else {
                let x = startWidth + e.clientX - startX;
                x = Math.max(x, 5);
                resizableElement.style.width = `${x}px`;
                resizableElement.style.height = "";
                resizableElement2.style.height = "";
            }
        };

        const stopDrag = () => {
            document.removeEventListener("mousemove", doDrag);
            document.removeEventListener("mouseup", stopDrag);
            resizer.classList.remove("resizing");
        };

        resizer.addEventListener("mousedown", (e) => {
            startX = e.clientX;
            startY = e.clientY;
            startWidth = parseInt(document.defaultView.getComputedStyle(resizableElement).width, 10);
            startHeight = parseInt(document.defaultView.getComputedStyle(resizableElement).height, 10);
            startHeight2 = window.innerHeight;
            resizer.classList.add("resizing");
            document.addEventListener("mousemove", doDrag);
            document.addEventListener("mouseup", stopDrag);
        });

        window.addEventListener("resize", () => {
            resizableElement.style.width = "";
            resizableElement.style.height = "";
            resizableElement2.style.height = "";
        });
    };

    // JSON Parsing Functions
    const parseJSON = (str) => {
        let hasError = false;

        class Snatch {
            constructor(todo) {
                this.done = "";
                this.todo = todo || "";
            }

            update(done, todo) {
                if (done) this.done += done;
                if (todo !== undefined) this.todo = ltrim(todo);
                return this;
            }

            swap(charNumber) {
                if (charNumber && !isNaN(Number(charNumber)) && this.todo.length >= charNumber) {
                    this.update(this.todo.substr(0, charNumber), this.todo.substring(charNumber));
                }
                return this;
            }

            toString() {
                if (this.todo.length !== 0) {
                    this.err("Text after last closing brace.", this.todo);
                }
                return this.done;
            }

            span(className, text) {
                return this.update(`<span class="${className}">${text}</span>`);
            }

            err(title, text) {
                hasError = true;
                return this.update(`<span class="error" title="${title}">${text}</span>`);
            }

            shift(nbOfChars) {
                let shifted = "";
                if (nbOfChars && !isNaN(Number(nbOfChars)) && this.todo.length >= nbOfChars) {
                    shifted = this.todo.substring(0, nbOfChars);
                    this.update("", this.todo.substring(nbOfChars));
                    return rtrim(shifted);
                }
                return shifted;
            }

            indexOf(searchValue, fromIndex) {
                return fromIndex ? this.todo.indexOf(searchValue, fromIndex) : this.todo.indexOf(searchValue);
            }

            substring(fromIndex, toIndex) {
                return toIndex ? this.todo.substring(fromIndex, toIndex) : this.todo.substring(fromIndex);
            }

            search(regex) {
                return this.todo.search(regex);
            }
        }

        const findEndString = (snatch) => {
            let current = 0;
            do {
                current = snatch.indexOf('"', current + 1);
                let nbBackslash = 0;
                let i = 1;
                while (snatch.substring(current - i, current - i + 1) === "\\") {
                    nbBackslash++;
                    i++;
                }
                if (nbBackslash % 2 === 0) break;
            } while (true);
            return current;
        };

        const parseString = (snatch) => {
            const firstChar = snatch.substring(0, 1);
            snatch.update("");
            if (firstChar === '"') {
                const name = snatch.shift(findEndString(snatch.todo) + 1);
                if (name.search(/\\u(?![\d|A-F|a-f]{4})/g) !== -1) {
                    return snatch.err("\\u must be followed by 4 hexadecimal characters", name);
                }
                for (let k = 0; k < name.length; k++) {
                    if (name[k] === "\\") {
                        if (k + 1 < name.length) {
                            k++;
                            if (!"\"\\\/bfnrtu".includes(name[k])) {
                                return snatch.err("Backslash must be escaped", name);
                            }
                        }
                    }
                }
                return snatch.update(`<span class="property">"<span class="p">${name.slice(1, -1)}</span>"</span>`);
            }
            const name = snatch.shift(snatch.indexOf(":"));
            return snatch.err("Name property must be a String wrapped in double quotes.", name);
        };

        const parsePair = (snatch) => {
            snatch.update("<li>");
            if (snatch.substring(0, 1) === "}") {
                return snatch.update("</li>");
            }
            snatch = parseString(snatch);
            if (snatch.substring(0, 1) !== ":") {
                snatch.err("Semi-column is missing.", snatch.shift(snatch.indexOf(":")));
            }
            snatch.swap(1);
            snatch = parseValue(snatch, "}");
            if (snatch.substring(0, 1) === ",") {
                snatch.swap(1).update("</li>");
                return parsePair(snatch);
            }
            if (snatch.substring(0, 1) === "}") {
                return snatch.update("</li>");
            }
            return snatch.err("Comma is missing", snatch.shift(snatch.indexOf("}"))).update("</li>");
        };

        const parseObject = (snatch) => {
            if (snatch.indexOf("{") === -1) {
                snatch.err("Opening brace is missing", snatch.todo);
                return snatch.update("", "");
            } else {
                snatch.shift(1);
                snatch.update('<span class="object"><span class="toggle">{</span><ul>');
                snatch = parsePair(snatch).update("</ul>");
                if (snatch.indexOf("}") === -1) {
                    snatch.err("Closing brace is missing", snatch.todo);
                    return snatch.update("", "");
                }
                return snatch.span("toggle-end", snatch.shift(1));
            }
        };

        const parseArray = (snatch) => {
            let io = 0;
            const parseElement = (snatch) => {
                snatch.update("<li>");
                snatch = parseValue(snatch, "]");
                if (snatch.substring(0, 1) === ",") {
                    snatch.swap(1).update("</li>");
                    return parseElement(snatch, ++io);
                }
                if (snatch.substring(0, 1) === "]") {
                    return snatch.update("</li>");
                }
                return snatch.err("Comma is missing", snatch.shift(snatch.search(/(,|\])/))).update("</li>");
            };

            if (snatch.indexOf("[") === -1) {
                snatch.err("Opening square bracket is missing", snatch.todo);
                return snatch.update("", "");
            }
            snatch.shift(1);
            snatch.update('<span class="array">');
            snatch.update('<span class="toggle">[</span><ol>');
            if (snatch.indexOf("]") === 0) {
                snatch.shift(1);
                snatch.update('</ol><span class="toggle-end" card="0">]</span>');
                return snatch.update("</span>");
            }
            snatch = parseElement(snatch, 0);
            if (snatch.indexOf("]") === -1) {
                snatch.err("Closing square bracket is missing", snatch.todo);
                snatch.update(`</ol><span class="toggle-end" card="${io + 1}"></span>`);
                return snatch.update("</span>");
            }
            snatch.shift(1);
            snatch.update(`</ol><span class="toggle-end" card="${io + 1}">]</span>`);
            return snatch.update("</span>");
        };

        const parseValue = (snatch, closingBracket) => {
            if (snatch.search(/^(")/) === 0) {
                const value = snatch.shift(findEndString(snatch.todo) + 1);
                if (value.search(/\\u(?![\d|A-F|a-f]{4})/g) !== -1) {
                    return snatch.err("\\u must be followed by 4 hexadecimal characters", value);
                }
                for (let k = 0; k < value.length; k++) {
                    if (value[k] === "\\") {
                        if (k + 1 < value.length) {
                            k++;
                            if (!"\"\\\/bfnrtu".includes(value[k])) {
                                return snatch.err("Backslash must be escaped", value);
                            }
                        }
                    }
                }
                return snatch.span("string", value);
            }
            if (snatch.search(/^\{/) === 0) {
                return parseObject(snatch);
            }
            if (snatch.search(/^\[/) === 0) {
                return parseArray(snatch);
            }
            const j = snatch.search(new RegExp(`(,|${closingBracket})`));
            const propertyValue = rtrim(j === -1 ? snatch.todo : snatch.shift(j));
            let type = "";
            try {
                type = typeOf(propertyValue);
            } catch (e) {}
            switch (type) {
                case "boolean":
                case "number":
                    return snatch.span(type, propertyValue);
                default:
                    if (propertyValue === "null") {
                        return snatch.span("null", propertyValue);
                    } else {
                        if (propertyValue.search(/^(')/) === 0) {
                            return snatch.err("String must be wrapped in double quotes", propertyValue);
                        }
                        return snatch.err("Unknown type", propertyValue);
                    }
            }
        };

        const snatch = new Snatch(trim(str));
        let result;
        if (ltrim(str).substr(0, 1) === "[") {
            result = {
                html: parseArray(snatch).toString(),
                valid: !hasError,
            };
        } else if (ltrim(str).substr(0, 1) === "{") {
            result = {
                html: parseObject(snatch).toString(),
                valid: !hasError,
            };
        } else {
            result = {
                html: snatch.err("JSON expression must be an object or an array", str).update(null, "").toString(),
                valid: false,
            };
        }
        return result;
    };

    // URL Management Functions
    const updateURL = () => {
        const json = $editor.value;
        const encodedJSON = encodeURIComponent(json);
        const newURL = `${window.location.origin}${window.location.pathname}?json=${encodedJSON}`;
        history.pushState({json}, '', newURL);
    };

    const decodeFromURL = () => {
        const urlParams = new URLSearchParams(window.location.search);
        const encodedJSON = urlParams.get('json');
        if (encodedJSON) {
            const json = decodeURIComponent(encodedJSON);
            $editor.value = json;
            analyze();
        }
    };

    // Main Analysis Function
    const analyze = () => {
        const changeFavicon = (s) => {
            const currentFavicon = document.querySelector("#favicon");
            const newFavicon = currentFavicon.cloneNode();
            newFavicon.setAttribute("href", `${FAVICON_BASE_PATH}${s}.png`);
            $head.replaceChild(newFavicon, currentFavicon);
        };

        const json = $editor.value;
        if (trim(json) === "") {
            $result.innerHTML = "";
            $status.classList.remove("status-error");
            changeFavicon("undefined");
            return;
        }

        $status.classList.remove("status-error");
        setTimeout(() => {
            const sanitizedJson = json.replace(/</g, "&lt;").replace(/>/g, "&gt;");
            const result = parseJSON(sanitizedJson);
            $result.innerHTML = result.html;
            if (result.valid) {
                changeFavicon("valid");
            } else {
                const nbErrors = (result.html.match(/class="error"/g) || []).length;
                $status.innerHTML = `<b>Invalid JSON</b> &nbsp; ${nbErrors}&nbsp;error${nbErrors > 1 ? "s" : ""}&nbsp;found`;
                $status.classList.add("status-error");
                changeFavicon("syntax-error");
            }
        }, 0);
        updateURL();
    };

    // Initialization
    const init = () => {
        setupUIOptions();
        setupResultToggle();
        setupResizer();

        $editor.addEventListener(EVENT_KEYUP, analyze);
        $editor.addEventListener(EVENT_CLICK, analyze);
        window.addEventListener('load', decodeFromURL);
        window.addEventListener('popstate', (event) => {
            if (event.state && event.state.json) {
                $editor.value = event.state.json;
                analyze();
            }
        });

        analyze();
        $editor.select();
    };

    // Public API
    return {
        init: init
    };
})();

// Initialize the JSONViewer
document.addEventListener('DOMContentLoaded', JSONViewer.init);