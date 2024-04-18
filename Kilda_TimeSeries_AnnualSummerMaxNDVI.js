/**** Start of imports. If edited, may not auto-convert in the playground. ****/
var kilda = ee.FeatureCollection("projects/ee-sanjanar199/assets/StKildaStudyArea");
/***** End of imports. If edited, may not auto-convert in the playground. *****/
// define ROI

var roi = kilda.geometry()

Map.addLayer(roi, {}, 'complete')

//recenter map
Map.setCenter(-8.5, 57.8, 12)

//Read in Landsat data but only in summer months
// Read in Landsat 8 Surface Reflectance Image Collection  
var l8sr = ee.ImageCollection('LANDSAT/LC08/C02/T1_L2')
                .filterBounds(roi)
                .filter(ee.Filter.calendarRange(2013, 2022, 'year'))
                .filter(ee.Filter.calendarRange(5,8,'month'));
                
// Read in Landsat 7 Surface Reflectance Image Collection  
var l7sr = ee.ImageCollection('LANDSAT/LE07/C02/T1_L2')
                .filterBounds(roi)
                .filter(ee.Filter.calendarRange(1999, 2022, 'year'))
                .filter(ee.Filter.calendarRange(5,8,'month'));
                
// Read in Landsat 5 Surface Reflectance Image Collection  
var l5sr = ee.ImageCollection('LANDSAT/LT05/C02/T1_L2')
                .filterBounds(roi)
                .filter(ee.Filter.calendarRange(1985, 2012, 'year'))
                .filter(ee.Filter.calendarRange(5,8,'month'));
                

// Cloud masking function for Landsat 8 collection 2 is on GitHub earthengine-api examples
// https://github.com/google/earthengine-api/blob/master/javascript/src/examples/CloudMasking/Landsat8SurfaceReflectance.js 
function maskL8sr(image) {

  var qaMask = image.select('QA_PIXEL').bitwiseAnd(parseInt('11111', 2)).eq(0);
  var saturationMask = image.select('QA_RADSAT').eq(0);

  // Apply the scaling factors to the appropriate bands.
  var opticalBands = image.select('SR_B.').multiply(0.0000275).add(-0.2);
  var thermalBands = image.select('ST_B.*').multiply(0.00341802).add(149.0);

  // Replace the original bands with the scaled ones and apply the masks.
  return image.addBands(opticalBands, null, true)
      .addBands(thermalBands, null, true)
      .updateMask(qaMask)
      .updateMask(saturationMask);
}

// Cloud masking function for Landsat 5,7 collection 2 is on GitHub earthengine-api examples
function maskL57sr(image) {
  // Bit 0 - Fill
  // Bit 1 - Dilated Cloud
  // Bit 2 - Unused
  // Bit 3 - Cloud
  // Bit 4 - Cloud Shadow
  var qaMask = image.select('QA_PIXEL').bitwiseAnd(parseInt('11111', 2)).eq(0);
  var saturationMask = image.select('QA_RADSAT').eq(0);

  // Apply the scaling factors to the appropriate bands.
  var opticalBands = image.select('SR_B.').multiply(0.0000275).add(-0.2);
  var thermalBand = image.select('ST_B6').multiply(0.00341802).add(149.0);

  // Replace the original bands with the scaled ones and apply the masks.
  return image.addBands(opticalBands, null, true)
      .addBands(thermalBand, null, true)
      .updateMask(qaMask)
      .updateMask(saturationMask);
}

// Map the functions 
// Apply the cloud masking function (filter on the region of interest)
l8sr = l8sr.filterBounds(roi).map(maskL8sr)
l7sr = l7sr.filterBounds(roi).map(maskL57sr)
l5sr = l5sr.filterBounds(roi).map(maskL57sr)

//Check results so far
//Map.addLayer(l8sr_composite, {bands: ['SR_B3', 'SR_B2', 'SR_B1'], min: 0, max: 0.3});

// NDVI, Merging the Image Collections, and Time Series Plot
// compute ndvi bands to add to each collection
var addL8Bands = function(image){
  var l8_ndvi = image.normalizedDifference(['SR_B5','SR_B4']).rename('ndvi')
  return image.addBands(l8_ndvi)
}

var addL7Bands = function(image){
  var l7_ndvi = image.normalizedDifference(['SR_B4','SR_B3']).rename('ndvi')
  return image.addBands(l7_ndvi)
}

var addL5Bands = function(image){
  var l5_ndvi = image.normalizedDifference(['SR_B4','SR_B3']).rename('ndvi')
  return image.addBands(l5_ndvi)
}

//Map func to different landsats 
l8sr = l8sr.map(addL8Bands)
l7sr = l7sr.map(addL7Bands)
l5sr = l5sr.map(addL5Bands)

print('L5 Images',l5sr)
print('L7 Images',l7sr)
print('L8 Images',l8sr)

// Merge the L8,l7,l5 collections, keeping only the NDVI bands
var merged = l8sr.merge(l7sr)
merged = merged.merge(l5sr)

var merged_ndvi = merged.select(['ndvi'])
print('NDVI from all Landsats', merged_ndvi)

//filter ndvi < 0.15
// Create a mask with the values you wish to retain
function maskndvi(image) {
var maskndvi = image.select('ndvi').gte(0.15)
                                       .and(image.select('ndvi').lte(0.9))
                return image.updateMask(maskndvi)
}
// Masked image
var maskedl5sr = l5sr.map(maskndvi)
var maskedl7sr = l7sr.map(maskndvi)
var maskedl8sr = l8sr.map(maskndvi)

//merge maskedndvi collections
var merged_ndvimask = maskedl5sr.merge(maskedl7sr)
merged_ndvimask = merged_ndvimask.merge(maskedl8sr)

//Print this collection out 
print('merged masked ndvi Images',merged_ndvimask)

//Select only NDVI columns
var merged_ndvimask_ndvi = merged_ndvimask.select(['ndvi'])


// Define years
var years = ee.List.sequence(1985, 2022);
// Map a function to select data within the year and apply reducer function to get max NDVI
var byYear = ee.ImageCollection.fromImages(
    years.map(function(y) {
      return merged_ndvimask_ndvi
        .filter(ee.Filter.calendarRange(y, y, 'year'))
        .filterBounds(roi)
        .reduce(ee.Reducer.max())
        //.copyProperties(merged_ndvi).set('system:time_start', merged_ndvi.get('system:time_start'))
        //.copyProperties(merged_ndvi, merged_ndvi.propertyNames())
        //.set('system:index', )
        .set('year', y).set('system:time_start', ee.Date.fromYMD(y, 8, 1));
    })
  );

print('Max NDVI per year', byYear)

// Estimate composites
// var l8sr_composite = l8sr.median();
// var l7sr_composite = l7sr.median();
// var l5sr_composite = l5sr.median();


// Set chart style properties.
// https://developers.google.com/earth-engine/guides/charts_style
var chartStyle = {
  title: 'Max NDVI from summer of every year from Landsats 5,7,8 for St.Kilda Study Area',
  hAxis: {
    title: 'Date',
    titleTextStyle: {italic: false, bold: true},
    gridlines: {color: 'FFFFFF'}
  },
  vAxis: {
    title: 'Max NDVI',
    titleTextStyle: {italic: false, bold: true},
    gridlines: {color: 'FFFFFF'},
    format: 'short',
    baselineColor: 'FFFFFF'
  },
    interpolateNulls: true,
    curveType: 'function',
    pointSize: 10,
  trendlines: {
    0: {  // add a trend line to the 1st series
      type: 'linear',  // or 'polynomial', 'exponential'
      color: '991d5b',
      lineWidth: 5,
      opacity: 0.5,
      visibleInLegend: false,
      pointSize: 0
    },
  },
//  lineWidth: 0.5,
//  colors: ['#4caf50'],
//  series: {1: {lineWidth: 5, color: '#087f23'}},
//  legend: {position: 'none'},  
  chartArea: {backgroundColor: 'EBEBEB'},
};
//
// Plot the merged Image Collection NDVI Time Series
var ndvi_timeseries = ui.Chart.image.series({
  imageCollection: byYear,
  region: roi,
//  reducer: ee.Reducer.mean(),
  scale: 30 // 	Scale to use with the reducer in meters
}).setOptions(chartStyle);

print(ndvi_timeseries)




//var NDVIcolor = {
//  min: 0,
//  max:1
//};
//
//// Declare years of interest
//var years = ee.List.sequence(1985, 2022);
//// Map a function to select data within the year and apply mean reducer
//var byYear = ee.ImageCollection.fromImages(
//    years.map(function(y) {
//      return merged_ndvi
//        .filter(ee.Filter.calendarRange(y, y, 'year'))
//        .reduce(ee.Reducer.mean())
//        .set('year', y);
//    })
//  );
//// Look at your output: 15 elemenets suggest we're on the right track
//print(byYear, "byYear");
//// Add 1999 to the map - looks good!
//Map.addLayer(byYear.first());
//
////merged_ndvi = ee.Image(merged_ndvi);
//
//

//Calculating year wise NDVI
//    var year = ee.List.sequence(1985,2022);
//    var year_func = function(y){
//      var range = ee.Filter.calendarRange (y, y, 'year');
//      return image_ndvi.select('NDVI').filter(range).mean().set ('Year', y)
//    };
//    var yearwise_ndvi = ee.ImageCollection(year.map(year_func));
//    print (yearwise_ndvi);
//    Map.addLayer (yearwise_ndvi)

// Estimate composites
// var l8sr_composite = l8sr.median();
// var l7sr_composite = l7sr.median();
// var l5sr_composite = l5sr.median();

//Remove NDVI < 0.15
//var maskNDVI = merged_ndvi.gt(0.15); //keep all pixels greater than 0.15
//var maskedNDVI = merged_ndvi.updateMask(maskNDVI); //Apply this in a mask


//var NDVIcolor = {
//  min: 0,
//  max:1
//};
//
//// Declare years of interest
//var years = ee.List.sequence(1985, 2022);
//// Map a function to select data within the year and apply mean reducer
//var byYear = ee.ImageCollection.fromImages(
//    years.map(function(y) {
//      return merged_ndvi
//        .filter(ee.Filter.calendarRange(y, y, 'year'))
//        .reduce(ee.Reducer.mean())
//        .set('year', y);
//    })
//  );
//// Look at your output: 15 elemenets suggest we're on the right track
//print(byYear, "byYear");
//// Add 1999 to the map - looks good!
//Map.addLayer(byYear.first());
//
////merged_ndvi = ee.Image(merged_ndvi);
//
//
