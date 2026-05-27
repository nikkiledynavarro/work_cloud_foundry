/* global QUnit */
QUnit.config.autostart = false;

sap.ui.getCore().attachInit(function () {
	"use strict";

	sap.ui.require([
		"com/erpis/shiperp/manualshipmentewm/hr7/test/unit/AllTests"
	], function () {
		QUnit.start();
	});
});