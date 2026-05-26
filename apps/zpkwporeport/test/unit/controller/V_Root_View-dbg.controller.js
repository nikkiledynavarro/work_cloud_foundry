/*global QUnit*/

sap.ui.define([
	"z/zpkw_poreport/controller/V_Root_View.controller"
], function (Controller) {
	"use strict";

	QUnit.module("V_Root_View Controller");

	QUnit.test("I should test the V_Root_View controller", function (assert) {
		var oAppController = new Controller();
		oAppController.onInit();
		assert.ok(oAppController);
	});

});