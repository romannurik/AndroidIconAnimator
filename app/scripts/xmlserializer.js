/*
 * Copyright 2016 Google Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// Based on https://github.com/cburgmer/xmlserializer/blob/master/lib/serializer.js
// Other options for pretty-printing:
// - https://github.com/travisleithead/xmlserialization-polyfill
// - https://github.com/prettydiff/prettydiff/blob/master/lib/markuppretty.js
// - https://github.com/vkiryukhin/vkBeautify

var removeInvalidCharacters = function (content) {
    // See http://www.w3.org/TR/xml/#NT-Char for valid XML 1.0 characters
    return content.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
};

var serializeAttributeValue = function (value) {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
};

var serializeTextContent = function (content) {
    return content
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
};

var serializeAttribute = function (attr) {
    var value = attr.value;

    return attr.name + '="' + serializeAttributeValue(value) + '"';
};

var getTagName = function (node) {
    var tagName = node.tagName;

    // Aid in serializing of original HTML documents
    if (node.namespaceURI === 'http://www.w3.org/1999/xhtml') {
        tagName = tagName.toLowerCase();
    }
    return tagName;
};

var serializeNamespace = function (node, options) {
    var nodeHasXmlnsAttr = Array.prototype.map.call(node.attributes || node.attrs, function (attr) {
            return attr.name;
        })
        .indexOf('xmlns') >= 0;
    // Serialize the namespace as an xmlns attribute whenever the element
    // doesn't already have one and the inherited namespace does not match
    // the element's namespace.
    if (!nodeHasXmlnsAttr && node.namespaceURI &&
        (options.isRootNode/* ||
         node.namespaceURI !== node.parentNode.namespaceURI*/)) {
         return ' xmlns="' + node.namespaceURI + '"';
    } else {
        return '';
    }
};

var serializeChildren = function (node, options) {
    return Array.prototype.map.call(node.childNodes, function (childNode) {
        return nodeTreeToXHTML(childNode, options);
    }).join('');
};

var serializeTag = function (node, options) {
    var output = '';
    if (options.indent && options._indentLevel) {
        output += Array(options._indentLevel * options.indent + 1).join(' ');
    }
    output += '<' + getTagName(node);
    output += serializeNamespace(node, options.isRootNode);

    var attributes = node.attributes || node.attrs;
    Array.prototype.forEach.call(attributes, function (attr) {
        if (options.multiAttributeIndent && attributes.length > 1) {
            output += '\n';
            output += Array((options._indentLevel || 0) * options.indent + options.multiAttributeIndent + 1).join(' ');
        } else {
            output += ' ';
        }
        output += serializeAttribute(attr);
    });

    if (node.childNodes.length > 0) {
        output += '>';
        if (options.indent) {
            output += '\n';
        }
        options.isRootNode = false;
        options._indentLevel = (options._indentLevel || 0) + 1;
        output += serializeChildren(node, options);
        --options._indentLevel;
        if (options.indent && options._indentLevel) {
            output += Array(options._indentLevel * options.indent + 1).join(' ');
        }
        output += '</' + getTagName(node) + '>';
    } else {
        output += '/>';
    }
    if (options.indent) {
        output += '\n';
    }
    return output;
};

var serializeText = function (node) {
    var text = node.nodeValue || node.value || '';
    return serializeTextContent(text);
};

var serializeComment = function (node) {
    return '<!--' +
        node.data
            .replace(/-/g, '&#45;') +
        '-->';
};

var serializeCDATA = function (node) {
    return '<![CDATA[' + node.nodeValue + ']]>';
};

var nodeTreeToXHTML = function (node, options) {
    if (node.nodeName === '#document' ||
        node.nodeName === '#document-fragment') {
        return serializeChildren(node, options);
    } else {
        if (node.tagName) {
            return serializeTag(node, options);
        } else if (node.nodeName === '#text') {
            return serializeText(node);
        } else if (node.nodeName === '#comment') {
            return serializeComment(node);
        } else if (node.nodeName === '#cdata-section') {
            return serializeCDATA(node);
        }
    }
};

exports.serializeToString = function (node, options) {
    options = options || {};
    options.rootNode = true;
    return removeInvalidCharacters(nodeTreeToXHTML(node, options));
};
