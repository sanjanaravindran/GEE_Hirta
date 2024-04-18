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
                

//Masking unwanted pixels
// Cloud masking function for Landsat 8 collection 2 is available on GitHub earthengine-api examples
// Here, masking done for bits 0-4 (Bit 0 - Fill, Bit 1 - Dilated Cloud, Bit 2 - Unused, Bit 3 - Cloud, Bit 4 - Cloud Shadow)
// Masking also done based on band saturation (qa_radsat)
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
// https://github.com/google/earthengine-api/blob/master/javascript/src/examples/CloudMasking/Landsat457SurfaceReflectance.js
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
// Apply the cloud masking function (and also filter on the region of interest)
l8sr = l8sr.filterBounds(roi).map(maskL8sr)
l7sr = l7sr.filterBounds(roi).map(maskL57sr)
l5sr = l5sr.filterBounds(roi).map(maskL57sr)

//Check results so far
//Map.addLayer(l8sr_composite, {bands: ['SR_B3', 'SR_B2', 'SR_B1'], min: 0, max: 0.3});

// NDVI, Merging the Image Collections, and Time Series Plot
// compute ndvi bands to add to each collection
var addL8Bands = function(image){
  var l8_ndvi = image.normalizedDifference(['SR_B5','SR_B4']).rename('l8_ndvi')
  var l7_ndvi = ee.Image().rename('l7_ndvi') 
  var l5_ndvi = ee.Image().rename('l5_ndvi') 
  return image.addBands(l8_ndvi).addBands(l7_ndvi).addBands(l5_ndvi)
}

var addL7Bands = function(image){
  var l7_ndvi = image.normalizedDifference(['SR_B4','SR_B3']).rename('l7_ndvi')
  var l8_ndvi = ee.Image().rename('l8_ndvi') 
  var l5_ndvi = ee.Image().rename('l5_ndvi') 
  return image.addBands(l7_ndvi).addBands(l8_ndvi).addBands(l5_ndvi)
}

var addL5Bands = function(image){
  var l5_ndvi = image.normalizedDifference(['SR_B4','SR_B3']).rename('l5_ndvi')
  var l8_ndvi = ee.Image().rename('l8_ndvi') 
  var l7_ndvi = ee.Image().rename('l7_ndvi') 
  return image.addBands(l5_ndvi).addBands(l8_ndvi).addBands(l7_ndvi)
}

//Map func to different landsats 
l8sr = l8sr.map(addL8Bands)
l7sr = l7sr.map(addL7Bands)
l5sr = l5sr.map(addL5Bands)

//Print collections out on console to check
print('L5 Images',l5sr)
print('L7 Images',l7sr)
print('L8 Images',l8sr)

//filter ndvi < 0.15
// Create a mask with the values you wish to retain
function maskL5ndvi(image) {
var maskndvi = image.select('l5_ndvi').gte(0.15)
                                       .and(image.select('l5_ndvi').lte(0.9))
                return image.updateMask(maskndvi)
}
// Masked image
var maskedl5sr = l5sr.map(maskL5ndvi)

// Create a mask with the values you wish to retain
function maskL7ndvi(image) {
var maskndvi = image.select('l7_ndvi').gte(0.15)
                                       .and(image.select('l7_ndvi').lte(0.9))
                return image.updateMask(maskndvi)
}
// Masked image
var maskedl7sr = l7sr.map(maskL7ndvi)

// Create a mask with the values you wish to retain
function maskL8ndvi(image) {
var maskndvi = image.select('l8_ndvi').gte(0.15)
                                       .and(image.select('l8_ndvi').lte(0.9))
                return image.updateMask(maskndvi)
}
// Masked image
var maskedl8sr = l8sr.map(maskL8ndvi)


// Merge the L8,l7,l5 collections, keeping only the NDVI bands
var merged = l5sr.merge(l7sr)
merged = merged.merge(l8sr)

//Print this collection out 
print('merged Images',merged)

//Select only NDVI columns
var merged_ndvi = merged.select(['l8_ndvi', 'l7_ndvi', 'l5_ndvi'])

//merge maskedndvi collections
var merged_ndvimask = maskedl5sr.merge(maskedl7sr)
merged_ndvimask = merged_ndvimask.merge(maskedl8sr)

//Print this collection out 
print('merged masked ndvi Images',merged_ndvimask)

//Select only NDVI columns
var merged_ndvimask_ndvi = merged_ndvimask.select(['l8_ndvi', 'l7_ndvi', 'l5_ndvi'])


// Set chart style properties.
// https://developers.google.com/earth-engine/guides/charts_style
var chartStyle = {
  title: 'Summer (May-August) NDVI from Landsats 5,7,8 for St.Kilda Study Area',
  hAxis: {
    title: 'Date',
    titleTextStyle: {italic: false, bold: true},
    gridlines: {color: 'FFFFFF'}
  },
  vAxis: {
    title: 'Mean NDVI',
    titleTextStyle: {italic: false, bold: true},
    gridlines: {color: 'FFFFFF'},
    format: 'short',
    baselineColor: 'FFFFFF'
  },
  trendlines: {
    0: {  // add a trend line to the 0th series
      type: 'linear',  // or 'polynomial', 'exponential'
      color: 'E37D05',
      lineWidth: 5,
      opacity: 0.6,
      visibleInLegend: false,
    },
    1: {  // add a trend line to the 1st series
      type: 'linear',  
      color: '1D6B99',
      lineWidth: 5,
      opacity: 0.6,
      visibleInLegend: false,
    },
    2: {  // add a trend line to the 2nd series
      type: 'linear',  
      color: '1D993E',
      lineWidth: 5,
      opacity: 0.6,
      visibleInLegend: false,
    },
  },
  series: {
    0: {color: 'E37D05', pointSize: 7, lineWidth: 0},
    1: {color: '1D6B99', pointSize: 7, lineWidth: 0},
    2: {color: '1D993E', pointSize: 7, lineWidth: 0}
  },
  chartArea: {backgroundColor: 'EBEBEB'}
};

// Plot the merged Image Collection NDVI Time Series
var ndvi_timeseries = ui.Chart.image.series({
  imageCollection: merged_ndvimask_ndvi,
  region: roi, //region of interest i.e. Hirta
  reducer: ee.Reducer.mean(),
  scale: 30 // 	Scale to use with the reducer in meters
}).setOptions(chartStyle);

print(ndvi_timeseries)
