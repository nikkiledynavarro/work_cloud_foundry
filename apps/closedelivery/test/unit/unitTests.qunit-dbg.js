/* global QUnit */
QUnit.config.autostart = false;

sap.ui.getCore().attachInit(function () {
	"use strict";

	sap.ui.require([
		"com/erpis/shiperp/closedelivery/hr7/closedelivery/test/unit/AllTests"
	], function () {
		QUnit.start();
	});
});