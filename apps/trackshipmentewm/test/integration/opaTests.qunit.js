/* global QUnit */
QUnit.config.autostart = false;

sap.ui.getCore().attachInit(function () {
	"use strict";

	sap.ui.require([
		"com/erpis/shiperp/trackshipmentewm/hr7/trackshipmentewm/test/integration/AllJourneys"
	], function () {
		QUnit.start();
	});
});