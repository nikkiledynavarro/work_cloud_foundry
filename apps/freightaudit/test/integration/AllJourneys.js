/*global QUnit*/

jQuery.sap.require("sap.ui.qunit.qunit-css");
jQuery.sap.require("sap.ui.thirdparty.qunit");
jQuery.sap.require("sap.ui.qunit.qunit-junit");
QUnit.config.autostart = false;

sap.ui.require([
	"sap/ui/test/Opa5",
	"com/erpis/shiperp/freightaudit/test/integration/pages/Common",
	"sap/ui/test/opaQunit",
	"com/erpis/shiperp/freightaudit/test/integration/pages/Worklist",
	"com/erpis/shiperp/freightaudit/test/integration/pages/Object",
	"com/erpis/shiperp/freightaudit/test/integration/pages/NotFound",
	"com/erpis/shiperp/freightaudit/test/integration/pages/Browser",
	"com/erpis/shiperp/freightaudit/test/integration/pages/App"
], function (Opa5, Common) {
	"use strict";
	Opa5.extendConfig({
		arrangements: new Common(),
		viewNamespace: "com.erpis.shiperp.freightaudit.view."
	});

	sap.ui.require([
		"com/erpis/shiperp/freightaudit/test/integration/WorklistJourney",
		"com/erpis/shiperp/freightaudit/test/integration/ObjectJourney",
		"com/erpis/shiperp/freightaudit/test/integration/NavigationJourney",
		"com/erpis/shiperp/freightaudit/test/integration/NotFoundJourney"
	], function () {
		QUnit.start();
	});
});