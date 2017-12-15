goog.provide('gmf.AbstractDesktopController');

goog.require('gmf');
goog.require('gmf.AbstractAppController');
/** @suppress {extraRequire} */
goog.require('ngeo.bboxQueryDirective');
/** @suppress {extraRequire} */
goog.require('gmf.contextualdataDirective');
/** @suppress {extraRequire} */
goog.require('gmf.displayquerygridComponent');
/** @suppress {extraRequire} */
goog.require('gmf.drawfeatureDirective');
/** @suppress {extraRequire} */
goog.require('gmf.editfeatureselectorDirective');
/** @suppress {extraRequire} */
goog.require('gmf.elevationDirective');
/** @suppress {extraRequire} */
goog.require('gmf.filterselectorComponent');
/** @suppress {extraRequire} */
goog.require('gmf.mousepositionComponent');
/** @suppress {extraRequire} */
goog.require('gmf.printComponent');
/** @suppress {extraRequire} */
goog.require('gmf.profileComponent');
/** @suppress {extraRequire} */
goog.require('gmf.drawprofilelineDirective');
/** @suppress {extraRequire} */
goog.require('gmf.lidarProfileComponent');
/** @suppress {extraRequire} */
goog.require('gmf.lidarPanelComponent');
/** @suppress {extraRequire} */
goog.require('gmf.LidarProfileConfig');
/** @suppress {extraRequire} */
goog.require('ngeo.DatePickerDirective');
/** @suppress {extraRequire} */
goog.require('gmf.TimeSliderDirective');
/** @suppress {extraRequire} */
goog.require('gmf.shareComponent');
/** @suppress {extraRequire} */
goog.require('ngeo.btnDirective');
/** @suppress {extraRequire} */
goog.require('ngeo.FeatureHelper');
/** @suppress {extraRequire} */
goog.require('ngeo.Features');
/** @suppress {extraRequire} */
goog.require('ngeo.ToolActivate');
goog.require('ol.Collection');
goog.require('ol.Map');
goog.require('ol.View');
goog.require('ol.control.ScaleLine');
goog.require('ol.control.Zoom');
goog.require('ol.interaction');
goog.require('ol.layer.Vector');
goog.require('ol.source.Vector');
goog.require('ol.style.Fill');
goog.require('ol.style.Stroke');
goog.require('ol.style.Style');
goog.require('ol.style.Text');

/** @suppress {extraRequire} */
goog.require('ngeo.sortableDirective');


gmf.module.value('isDesktop', true);

gmf.module.value('ngeoQueryOptions', {
  'limit': 20
});

gmf.module.value('ngeoMeasurePrecision', 3);
gmf.module.value('ngeoMeasureDecimals', 0);


/**
 * Desktop application abstract controller.
 *
 * This file includes `goog.require`'s for desktop components/directives used
 * by the HTML page and the controller to provide the configuration.
 *
 * @param {gmfx.Config} config A part of the application config.
 * @param {angular.Scope} $scope Scope.
 * @param {angular.$injector} $injector Main injector.
 * @constructor
 * @extends {gmf.AbstractAppController}
 * @ngdoc controller
 * @ngInject
 * @export
 */
gmf.AbstractDesktopController = function(config, $scope, $injector) {

  const viewConfig = {
    projection: ol.proj.get(`EPSG:${config.srid || 21781}`)
  };
  ol.obj.assign(viewConfig, config.mapViewConfig || {});

  const arrow = gmf.AbstractAppController.prototype.getLocationIcon();

  /**
   * @type {ol.Map}
   * @export
   */
  this.map = new ol.Map({
    layers: [],
    view: new ol.View(viewConfig),
    controls: config.mapControls || [
      new ol.control.ScaleLine({
        target: document.getElementById('scaleline')
      }),
      new ol.control.Zoom({
        zoomInTipLabel: '',
        zoomOutTipLabel: ''
      }),
      new ol.control.Rotate({
        label: arrow,
        tipLabel: ''
      })
    ],
    interactions: config.mapInteractions || ol.interaction.defaults({
      pinchRotate: true,
      altShiftDragRotate: true
    }),
    loadTilesWhileAnimating: true,
    loadTilesWhileInteracting: true
  });

  /**
   * @type {boolean}
   * @export
   */
  this.loginActive = false;

  /**
   * @type {boolean}
   * @export
   */
  this.toolsActive = false;

  /**
   * @type {boolean}
   * @export
   */
  this.modalShareShown = false;

  /**
   * @type {boolean}
   * @export
   */
  this.editFeatureActive = false;

  /**
   * @type {boolean}
   * @export
   */
  this.googleStreetViewActive = false;

  /**
   * @type {!ol.style.Style}
   * @export
   */
  this.googleStreetViewStyle = new ol.style.Style({
    text: new ol.style.Text({
      fill: new ol.style.Fill({color: '#279B61'}),
      font: 'normal 30px FontAwesome',
      offsetY: -15,
      stroke: new ol.style.Stroke({color: '#ffffff', width: 3}),
      text: '\uf041'
    })
  });

  /**
   * @type {boolean}
   * @export
   */
  this.importDataSourceActive = false;

  const body = $('body');

  // initialize tooltips
  body.tooltip({
    container: 'body',
    trigger: 'hover',
    selector: '[data-toggle="tooltip"]'
  });

  // deactivate tooltips on touch device
  body.on('touchstart.detectTouch', () => {
    body.tooltip('destroy');
    body.off('touchstart.detectTouch');
  });

  /**
   * Collection of features for the draw interaction
   * @type {ol.Collection.<ol.Feature>}
   */
  const ngeoFeatures = $injector.get('ngeoFeatures');

  /**
   * @type {ngeo.map.FeatureOverlay}
   * @export
   */
  this.drawFeatureLayer = $injector.get('ngeoFeatureOverlayMgr')
    .getFeatureOverlay();
  this.drawFeatureLayer.setFeatures(ngeoFeatures);

  const ngeoFeatureHelper = $injector.get('ngeoFeatureHelper');

  /**
   * @type {ol.layer.Vector}
   * @export
   */
  this.editFeatureVectorLayer = new ol.layer.Vector({
    source: new ol.source.Vector({
      wrapX: false,
      features: new ol.Collection()
    }),
    style: (feature, resolution) => ngeoFeatureHelper.createEditingStyles(feature)
    // style: ngeoFeatureHelper.createEditingStyles.bind(ngeoFeatureHelper)
  });
  this.editFeatureVectorLayer.setMap(this.map);

  /**
   * The ngeo ToolActivate manager service.
   * @type {ngeo.ToolActivateMgr}
   */
  const ngeoToolActivateMgr = $injector.get('ngeoToolActivateMgr');

  const editFeatureActivate = new ngeo.ToolActivate(this, 'editFeatureActive');
  ngeoToolActivateMgr.registerTool('mapTools', editFeatureActivate, false);

  const googleStreetViewActivate = new ngeo.ToolActivate(
    this,
    'googleStreetViewActive'
  );
  ngeoToolActivateMgr.registerTool('mapTools', googleStreetViewActivate, false);

  /**
   * @type {ngeox.ScaleselectorOptions}
   * @export
   */
  this.scaleSelectorOptions = {
    dropup: true
  };

  /**
   * @type {ol.geom.LineString}
   * @export
   */
  this.profileLine = null;

  /**
   * @type {ol.geom.LineString}
   * @export
   */
  this.lidarProfileLine = null;

  gmf.AbstractAppController.call(this, config, $scope, $injector);

  // close the login panel on successful login
  $scope.$watch(() => this.gmfUser.username, (newVal) => {
    if (newVal !== null && this.loginActive) {
      this.loginActive = false;
    }
  });

};
ol.inherits(gmf.AbstractDesktopController, gmf.AbstractAppController);


gmf.module.controller(
  'AbstractDesktopController',
  gmf.AbstractDesktopController);