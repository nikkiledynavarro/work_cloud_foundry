/* global QUnit */
QUnit.config.autostart = false;

sap.ui.getCore().attachInit(function () {
	"use strict";

	sap.ui.require([
		"com/erpis/shiperp/manualecc/hr7/manualecchr7/test/unit/AllTests"
	], function () {
		QUnit.start();
	});
});