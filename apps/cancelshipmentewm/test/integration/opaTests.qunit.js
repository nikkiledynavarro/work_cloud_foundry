/* global QUnit */
QUnit.config.autostart = false;

sap.ui.getCore().attachInit(function () {
	"use strict";

	sap.ui.require([
		"com/erpis/shiperp/cancelshipewm/hr7/cancelshipewm/test/integration/AllJourneys"
	], function () {
		QUnit.start();
	});
});