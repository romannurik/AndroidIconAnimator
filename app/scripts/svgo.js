import convertSvgToJs from 'svgo/lib/svgo/svg2js.js';
import executePlugins from 'svgo/lib/svgo/plugins.js';
import convertJsToSvg from 'svgo/lib/svgo/js2svg.js';


// The complete list is available here: https://github.com/svg/svgo/blob/master/.svgo.yml
const svgoPlugins = {
  removeDoctype: require('svgo/plugins/removeDoctype'),
  removeXMLProcInst: require('svgo/plugins/removeXMLProcInst'),
  removeComments: require('svgo/plugins/removeComments'),
  removeMetadata: require('svgo/plugins/removeMetadata'),
  removeXMLNS: require('svgo/plugins/removeXMLNS'), // disabled
  removeEditorsNSData: require('svgo/plugins/removeEditorsNSData'),
  cleanupAttrs: require('svgo/plugins/cleanupAttrs'),
  minifyStyles: require('svgo/plugins/minifyStyles'),
  convertStyleToAttrs: require('svgo/plugins/convertStyleToAttrs'),
  cleanupIDs: require('svgo/plugins/cleanupIDs'),
  removeRasterImages: require('svgo/plugins/removeRasterImages'), // disabled
  removeUselessDefs: require('svgo/plugins/removeUselessDefs'),
  cleanupNumericValues: require('svgo/plugins/cleanupNumericValues'),
  cleanupListOfValues: require('svgo/plugins/cleanupListOfValues'),
  convertColors: require('svgo/plugins/convertColors'),
  removeUnknownsAndDefaults: require('svgo/plugins/removeUnknownsAndDefaults'),
  removeNonInheritableGroupAttrs: require('svgo/plugins/removeNonInheritableGroupAttrs'),
  removeUselessStrokeAndFill: require('svgo/plugins/removeUselessStrokeAndFill'),
  removeViewBox: require('svgo/plugins/removeViewBox'), // disabled
  cleanupEnableBackground: require('svgo/plugins/cleanupEnableBackground'),
  removeHiddenElems: require('svgo/plugins/removeHiddenElems'),
  removeEmptyText: require('svgo/plugins/removeEmptyText'),
  convertShapeToPath: require('svgo/plugins/convertShapeToPath'),
  moveElemsAttrsToGroup: require('svgo/plugins/moveElemsAttrsToGroup'),
  moveGroupAttrsToElems: require('svgo/plugins/moveGroupAttrsToElems'),
  collapseGroups: require('svgo/plugins/collapseGroups'),
  convertPathData: require('svgo/plugins/convertPathData'),
  convertTransform: require('svgo/plugins/convertTransform'),
  removeEmptyAttrs: require('svgo/plugins/removeEmptyAttrs'),
  removeEmptyContainers: require('svgo/plugins/removeEmptyContainers'),
  mergePaths: require('svgo/plugins/mergePaths'),
  removeUnusedNS: require('svgo/plugins/removeUnusedNS'),
  transformsWithOnePath: require('svgo/plugins/transformsWithOnePath'), // disabled
  sortAttrs: require('svgo/plugins/sortAttrs'),
  removeTitle: require('svgo/plugins/removeTitle'), // disabled
  removeDesc: require('svgo/plugins/removeDesc'),
  removeDimensions: require('svgo/plugins/removeDimensions'), // disabled
  removeAttrs: require('svgo/plugins/removeAttrs'), // disabled
  removeElementsByAttr: require('svgo/plugins/removeElementsByAttr'), // disabled
  addClassesToSVGElement: require('svgo/plugins/addClassesToSVGElement'), // disabled
  removeStyleElement: require('svgo/plugins/removeStyleElement'), // disabled
  addAttributesToSVGElement: require('svgo/plugins/addAttributesToSVGElement'), // disabled
};

// Create batches of svgo plugins to run in their optimal order.
// See also: https://github.com/svg/svgo/blob/master/docs/how-it-works/en.md#3-plugins
const batchedSvgoPlugins = (() => {
  let prevBatch;
  return Object.keys(svgoPlugins)
    .map(p => [svgoPlugins[p]])
    .filter(batch => {
      if (prevBatch && batch[0].type === prevBatch[0].type) {
        prevBatch.push(batch[0]);
        return false;
      }
      prevBatch = batch;
      return true;
    });
})();

export const Svgo = {

  optimize(svgText, callback) {
    convertSvgToJs(svgText, svgJs => {
      if (svgJs.error) {
        console.warn('Failed to parse the specified SVG string.');
        callback(svgText);
        return;
      }
      callback(convertJsToSvg(executePlugins(svgJs, batchedSvgoPlugins), {
        indent: '  ',
        pretty: true,
      }).data);
    });
  }
};
