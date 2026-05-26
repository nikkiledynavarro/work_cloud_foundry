/*global QUnit*/

jQuery.sap.require("sap.ui.qunit.qunit-css");
jQuery.sap.require("sap.ui.thirdparty.qunit");
jQuery.sap.require("sap.ui.qunit.qunit-junit");
QUnit.config.autostart = false;

sap.ui.require([
	"sap/ui/test/Opa5",
	"com/erpis/shiperp/dispute/test/integration/pages/Common",
	"sap/ui/test/opaQunit",
	"com/erpis/shiperp/dispute/test/integration/pages/Worklist",
	"com/erpis/shiperp/dispute/test/integration/pages/Object",
	"com/erpis/shiperp/dispute/test/integration/pages/NotFound",
	"com/erpis/shiperp/dispute/test/integration/pages/Browser",
	"com/erpis/shiperp/dispute/test/integration/pages/App"
], function (Opa5, Common) {
	"use strict";
	Opa5.extendConfig({
		arrangements: new Common(),
		viewNamespace: "com.erpis.shiperp.dispute.view."
	});

	sap.ui.require([
		"com/erpis/shiperp/dispute/test/integration/WorklistJourney",
		"com/erpis/shiperp/dispute/test/integration/ObjectJourney",
		"com/erpis/shiperp/dispute/test/integration/NavigationJourney",
		"com/erpis/shiperp/dispute/test/integration/NotFoundJourney"
	], function () {
		QUnit.start();
	});
});