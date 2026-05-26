/*global QUnit*/

jQuery.sap.require("sap.ui.qunit.qunit-css");
jQuery.sap.require("sap.ui.thirdparty.qunit");
jQuery.sap.require("sap.ui.qunit.qunit-junit");
QUnit.config.autostart = false;

sap.ui.require([
	"sap/ui/test/Opa5",
	"com/erpis/shiperp/cancel/test/integration/pages/Common",
	"sap/ui/test/opaQunit",
	"com/erpis/shiperp/cancel/test/integration/pages/Worklist",
	"com/erpis/shiperp/cancel/test/integration/pages/Object",
	"com/erpis/shiperp/cancel/test/integration/pages/NotFound",
	"com/erpis/shiperp/cancel/test/integration/pages/Browser",
	"com/erpis/shiperp/cancel/test/integration/pages/App"
], function (Opa5, Common) {
	"use strict";
	Opa5.extendConfig({
		arrangements: new Common(),
		viewNamespace: "com.erpis.shiperp.cancel.view."
	});

	sap.ui.require([
		"com/erpis/shiperp/cancel/test/integration/WorklistJourney",
		"com/erpis/shiperp/cancel/test/integration/ObjectJourney",
		"com/erpis/shiperp/cancel/test/integration/NavigationJourney",
		"com/erpis/shiperp/cancel/test/integration/NotFoundJourney"
	], function () {
		QUnit.start();
	});
});