goog.provide('ngeo.lidarProfile.loader');
goog.require('ol.interaction.Select');
goog.require('ol.interaction.Modify');

ngeo.lidarProfile.options = {};

ngeo.lidarProfile.setOptions = function(options) {

  ngeo.lidarProfile.options = options;

  ngeo.lidarProfile.loader.cartoHighlight = new ol.Overlay({
    offset: [0, -15],
    positioning: 'bottom-center'
  });
  ngeo.lidarProfile.loader.cartoHighlight.setMap(options.map);

};

ngeo.lidarProfile.loader.requestsQueue = [];

ngeo.lidarProfile.loader.getProfileByLOD = function(distanceOffset, resetPlot, minLOD, maxLOD) {

  ngeo.lidarProfile.options.pytreeLinestring =  ngeo.lidarProfile.utils.getPytreeLinestring(ngeo.lidarProfile.options.olLinestring);

  const uuid = ngeo.lidarProfile.utils.UUID();
  ngeo.lidarProfile.loader.lastUuid = uuid;
  let lastLOD = false;

  ngeo.lidarProfile.loader.profilePoints = {
    distance: [],
    altitude: [],
    color_packed: [],
    intensity: [],
    classification: [],
    coords: []
  };

  for (let i = 0; i < maxLOD; i++) {
    if (i == 0) {
      ngeo.lidarProfile.loader.xhrRequest(ngeo.lidarProfile.options, minLOD, ngeo.lidarProfile.options.profileConfig.initialLOD, i, ngeo.lidarProfile.options.pytreeLinestring, distanceOffset, lastLOD, ngeo.lidarProfile.options.profileConfig.profilWidth, resetPlot, uuid);
      i += ngeo.lidarProfile.options.profileConfig.initialLOD - 1;
    } else if (i < maxLOD - 1) {
      ngeo.lidarProfile.loader.xhrRequest(ngeo.lidarProfile.options, minLOD + i, minLOD + i + 1, i, ngeo.lidarProfile.options.pytreeLinestring, distanceOffset, lastLOD, ngeo.lidarProfile.options.profileConfig.profilWidth, false, uuid);
    } else {
      lastLOD = true;
      ngeo.lidarProfile.loader.xhrRequest(ngeo.lidarProfile.options, minLOD + i, minLOD + i + 1, i, ngeo.lidarProfile.options.pytreeLinestring, distanceOffset, lastLOD, ngeo.lidarProfile.options.profileConfig.profilWidth, false, uuid);
    }
  }

};

ngeo.lidarProfile.loader.xhrRequest = function(options, minLOD, maxLOD, iter, coordinates, distanceOffset, lastLOD, width, resetPlot, uuid) {
  d3.select('#profileInfo').html(`Loading levels:\n ${minLOD}  to ${maxLOD} ...`);
  // TODO get pointCloud from pytree config
  const hurl = `${options.pytreeLidarProfileJsonUrl_}/get_profile?minLOD=${minLOD}&maxLOD=${maxLOD}&width=${width}&coordinates=${coordinates}&pointCloud=sitn2016&attributes='`;

  for (let i = 0; i < ngeo.lidarProfile.loader.requestsQueue.length; i++) {
    if (ngeo.lidarProfile.loader.requestsQueue[i].uuid != ngeo.lidarProfile.loader.lastUuid) {
      ngeo.lidarProfile.loader.requestsQueue[i].abort();
      ngeo.lidarProfile.loader.requestsQueue.splice(i, 1);
    }
  }

  const xhr = new XMLHttpRequest();
  xhr.uuid = uuid;
  xhr.open('GET', hurl, true);
  xhr.responseType = 'arraybuffer';
  xhr.overrideMimeType('text/plain; charset=x-user-defined');
  xhr.onreadystatechange = function() {
    if (xhr.readyState === 4) {
      if (xhr.status === 200) {
        if (this.uuid == ngeo.lidarProfile.loader.lastUuid) {
          d3.select('#profileInfo').html(`Levels loaded:<br> ${minLOD} to ${maxLOD}`);
          ngeo.lidarProfile.loader.processBuffer(options, xhr.response, iter, distanceOffset, lastLOD, resetPlot);
        }
      }
    }
  };

  try {
    ngeo.lidarProfile.loader.requestsQueue.push(xhr);
    xhr.send(null);
  } catch (e) {
    console.log(e);
  }
};

ngeo.lidarProfile.loader.processBuffer = function(options, profile, iter, distanceOffset, lastLOD, resetPlot) {

  try {

    const typedArrayInt32 = new Int32Array(profile, 0, 4);
    const headerSize = typedArrayInt32[0];

    const uInt8header = new Uint8Array(profile, 4, headerSize);
    let strHeaderLocal = '';
    for (let i = 0; i < uInt8header.length; i++) {
      strHeaderLocal += String.fromCharCode(uInt8header[i]);
    }

    const isEmpty = strHeaderLocal.indexOf('"points": 0');
    if (isEmpty != -1) {
      return;
    }

    const jHeader = JSON.parse(strHeaderLocal);
    const attr = jHeader.pointAttributes;
    const attributes = [];
    for (let j = 0; j < attr.length; j++) {
      if (ngeo.lidarProfile.options.profileConfig.pointAttributes[attr[j]] != undefined) {
        attributes.push(ngeo.lidarProfile.options.profileConfig.pointAttributes[attr[j]]);
      }
    }

    const scale = jHeader.scale;
    const points = {
      distance: [],
      altitude: [],
      classification: [],
      intensity: [],
      color_packed: [],
      coords: []
    };
    const bytesPerPoint = jHeader.bytesPerPoint;
    const buffer = profile.slice(4 + headerSize);

    for (let i = 0; i < jHeader.points; i++) {

      const byteOffset = bytesPerPoint * i;
      const view = new DataView(buffer, byteOffset, bytesPerPoint);
      let aoffset = 0;
      for (let k = 0; k < attributes.length; k++) {

        const attribute = attributes[k];

        if (attribute.name == 'POSITION_PROJECTED_PROFILE') {

          const ux = view.getUint32(aoffset, true);
          const uy = view.getUint32(aoffset + 4, true);
          const x = ux * scale;
          const y = uy * scale;
          points.distance.push(Math.round(100 * (distanceOffset + x)) / 100);
          points.altitude.push(Math.round(100 * y) / 100);
          ngeo.lidarProfile.loader.profilePoints.distance.push(Math.round(100 * (distanceOffset + x)) / 100);
          ngeo.lidarProfile.loader.profilePoints.altitude.push(Math.round(100 * y) / 100);

        } else if (attribute.name == 'CLASSIFICATION') {
          const classif = view.getUint8(aoffset, true);
          points.classification.push(classif);
          ngeo.lidarProfile.loader.profilePoints.classification.push(classif);

        } else if (attribute.name == 'INTENSITY') {
          const intensity = view.getUint16(aoffset, true);
          points.intensity.push(intensity);
          ngeo.lidarProfile.loader.profilePoints.intensity.push(intensity);

        } else if (attribute.name == 'COLOR_PACKED') {
          const r = view.getUint8(aoffset, true);
          const g = view.getUint8(aoffset + 1, true);
          const b = view.getUint8(aoffset + 2, true);
          points.color_packed.push([r, g, b]);
          ngeo.lidarProfile.loader.profilePoints.color_packed.push([r, g, b]);

        } else if (attribute.name == 'POSITION_CARTESIAN') {
          const x = view.getInt32(aoffset, true) * scale + jHeader.boundingBox.lx;
          const y = view.getInt32(aoffset + 4, true) * scale + jHeader.boundingBox.ly;
          // TODO handle CRS
          points.coords.push([x, y]);
          ngeo.lidarProfile.loader.profilePoints.coords.push([x, y]);
        }
        aoffset = aoffset + attribute.bytes;
      }
    }
    const initialProfile = ngeo.lidarProfile.utils.getLinestring();
    const lastSegment = initialProfile[initialProfile.length - 1];
    const rangeX = [0, lastSegment.endD];
    const rangeY = [ngeo.lidarProfile.plot2canvas.arrayMin(points.altitude), ngeo.lidarProfile.plot2canvas.arrayMax(points.altitude)];

    if (iter == 0 && resetPlot) {
      ngeo.lidarProfile.plot2canvas.setupPlot(rangeX, rangeY);
      ngeo.lidarProfile.plot2canvas.drawPoints(points, options.profileConfig.defaultAttribute,
        ngeo.lidarProfile.options.profileConfig.currentZoom);

    } else {
      ngeo.lidarProfile.plot2canvas.drawPoints(points, options.profileConfig.defaultAttribute,
        ngeo.lidarProfile.options.profileConfig.currentZoom);
    }

  } catch (e) {
    console.log(e);
  }
};

ngeo.lidarProfile.loader.updateData = function() {
  console.log('updatedata function called');
  const domain = ngeo.lidarProfile.options.profileConfig.scaleX.domain();
  const clip = ngeo.lidarProfile.utils.clipLineByMeasure(domain[0], domain[1]);
  const span = domain[1] - domain[0];
  const niceLOD = ngeo.lidarProfile.utils.getNiceLOD(span);
  const previousSpan = ngeo.lidarProfile.options.profileConfig.previousDomain[1] - ngeo.lidarProfile.options.profileConfig.previousDomain[0];
  const dxL = ngeo.lidarProfile.options.profileConfig.previousDomain[0] - domain[0];
  const dxR = ngeo.lidarProfile.options.profileConfig.previousDomain[1] - domain[1];

  ngeo.lidarProfile.options.profileConfig.previousDomain = domain;

  const zoomDir = previousSpan - span;

  if (niceLOD <= ngeo.lidarProfile.options.profileConfig.initialLOD && zoomDir > 0) {
    ngeo.lidarProfile.plot2canvas.drawPoints(ngeo.lidarProfile.loader.profilePoints, ngeo.lidarProfile.options.profileConfig.defaultAttribute, ngeo.lidarProfile.options.profileConfig.currentZoom);
    return;

  } else if (niceLOD <= ngeo.lidarProfile.options.profileConfig.initialLOD && Math.abs(dxL) == 0 && Math.abs(dxR) == 0) {
    ngeo.lidarProfile.plot2canvas.drawPoints(ngeo.lidarProfile.loader.profilePoints, ngeo.lidarProfile.options.profileConfig.defaultAttribute, ngeo.lidarProfile.options.profileConfig.currentZoom);
    return;

  } else {
    const line = clip.clippedLine;
    if (clip.clippedLine.length < 2) {
      return;
    }

    let cPotreeLineStr = '';
    for (const i in line) {
      cPotreeLineStr += `{${line[i][0]} + ',' + ${line[i][1]}},`;
    }
    cPotreeLineStr = cPotreeLineStr.substr(0, cPotreeLineStr.length - 1);
    ngeo.lidarProfile.loader.getProfileByLOD(clip.distanceOffset, false, 0, niceLOD);

  }

};
