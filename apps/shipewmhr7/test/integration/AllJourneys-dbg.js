/*global QUnit*/

jQuery.sap.require("sap.ui.qunit.qunit-css");
jQuery.sap.require("sap.ui.thirdparty.qunit");
jQuery.sap.require("sap.ui.qunit.qunit-junit");
QUnit.config.autostart = false;

sap.ui.require([
	"sap/ui/test/Opa5",
	"com/erpis/shiperp/shipewm/hr7/test/integration/pages/Common",
	"sap/ui/test/opaQunit",
	"com/erpis/shiperp/shipewm/hr7/test/integration/pages/Worklist",
	"com/erpis/shiperp/shipewm/hr7/test/integration/pages/Object",
	"com/erpis/shiperp/shipewm/hr7/test/integration/pages/NotFound",
	"com/erpis/shiperp/shipewm/hr7/test/integration/pages/Browser",
	"com/erpis/shiperp/shipewm/hr7/test/integration/pages/App"
], function (Opa5, Common) {
	"use strict";
	Opa5.extendConfig({
		arrangements: new Common(),
		viewNamespace: "com.erpis.shiperp.shipewm.hr7.view."
	});

	sap.ui.require([
		"com/erpis/shiperp/shipewm/hr7/test/integration/WorklistJourney",
		"com/erpis/shiperp/shipewm/hr7/test/integration/ObjectJourney",
		"com/erpis/shiperp/shipewm/hr7/test/integration/NavigationJourney",
		"com/erpis/shiperp/shipewm/hr7/test/integration/NotFoundJourney"
	], function () {
		QUnit.start();
	});
});