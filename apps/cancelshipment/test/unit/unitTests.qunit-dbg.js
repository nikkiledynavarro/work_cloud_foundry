/* global QUnit */
QUnit.config.autostart = false;

sap.ui.getCore().attachInit(function () {
	"use strict";

	sap.ui.require([
		"com/erpis/shiperp/sls/cancelshipment/test/unit/AllTests"
	], function () {
		QUnit.start();
	});
});