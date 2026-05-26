/* global QUnit */
QUnit.config.autostart = false;

sap.ui.getCore().attachInit(function () {
	"use strict";

	sap.ui.require([
		"com/erpis/shiperp/manualshipmentewm/hr7/test/integration/AllJourneys"
	], function () {
		QUnit.start();
	});
});