/*global location*/
jQuery.sap.require("com.erpis.shiperp.trackshipment.hr7.common.jquery_hotkeys");
sap.ui.define([
	"com/erpis/shiperp/trackshipment/hr7/controller/BaseController",
	"sap/ui/model/json/JSONModel",
	"com/erpis/shiperp/trackshipment/hr7/model/formatter",
	"sap/m/Token",
	"sap/ui/model/Filter",
	"sap/m/MessageBox",
	"sap/m/MessageToast",
	"com/erpis/shiperp/trackshipment/hr7/common/Utils",
	"com/erpis/shiperp/trackshipment/hr7/common/hotkeyInterface"
], function (BaseController, JSONModel, formatter, Token, Filter, MessageBox, MessageToast, Utils, HotkeyInterface) {
	"use strict";

	return BaseController.extend("com.erpis.shiperp.trackshipment.hr7.controller.Main", {

		_oLogger: jQuery.sap.log.getLogger("com.erpis.shiperp.trackshipment.hr7.controller.Main"),
		formatter: formatter,
		oBundle: null, // i18n bundle class
		// Commonly used controller attributes
		sProfile: "", // Shipping profile
		sStation: "", // Shipping station
		sInputID: "", // Input ID
		sInputType: "", // Input Type

		/* =========================================================== */
		/* lifecycle methods                                           */
		/* =========================================================== */
		/**
		 * Called when the worklist controller is instantiated.
		 * @public
		 */
		onInit: function () {
			// Set the controller property to be used globally in the controller
			this.oBundle = this.getResourceBundle();

			// Local Model for view
			var oViewModel = new JSONModel({
				Shipments: []
			});
			this.setModel(oViewModel, "local");

			this.getRouter().getRoute("main").attachPatternMatched(this._onObjectMatched, this);

			// Initialize Message Model
			var oJSONModel = new JSONModel({
				aMessages: [],
				messagesLength: 0
			});
			this.setModel(oJSONModel, "messageModel");
		},

		/**
		 * Binds the view to the object path.
		 * @function
		 * @param {sap.ui.base.Event} oEvent pattern match event in route 'object'
		 * @private
		 */
		_onObjectMatched: function (oEvent) {
			this.sStation = oEvent.getParameter("arguments").Station;
			this.sProfile = oEvent.getParameter("arguments").Profile;
			var iStart = window.location.href.indexOf("?trackno=");
			var iEnd = window.location.href.lastIndexOf("&");
			var sTrackno = "";
			if (iEnd !== -1 && iStart !== -1) {
				sTrackno = window.location.href.slice(iStart + "?trackno=".length, iEnd);
			}

			if (sTrackno) {
				this.byId("cbInputType").setSelectedKey("7"); //Tracking Number
				this.byId("txtId").setValue(sTrackno);
				this.byId("txtId").fireSubmit();
			}
			this.hideBusy();
		},

		/* =========================================================== */
		/* event handlers                                              */
		/* =========================================================== */
		onSubmit: function (oEvent) {
			if (this.byId("cbInputType").getSelectedKey() !== "") {
				this.sInputType = this.byId("cbInputType").getSelectedKey();
				this.byId("cbInputType").setValueState("None");
			} else {
				MessageBox.error(this.oBundle.getText("missingInputType"));
				this.byId("cbInputType").setValueState("Error");
				return;
			}

			if (oEvent.getSource().getValue() === "") {
				MessageBox.error(this.oBundle.getText("missingInputID"));
				this.byId("txtId").setValueState("Error");
				return;
			} else {
				this.byId("txtId").setValueState("None");
			}

			this.sInputID = oEvent.getSource().getValue();
			this.showBusy();
			this.getModel().callFunction("/TrackShipment", {
				method: "GET",
				urlParameters: {
					Profile: this.sProfile,
					Station: this.sStation,
					InputType: this.sInputType,
					InputId: this.sInputID
				},
				success: function (oData) {
					var aOutput = [];
					aOutput = this.treeify(oData.results);
					this.getModel("local").setProperty("/Shipments", aOutput);
					this.hideBusy();
				}.bind(this),
				error: function (oError) {
					this.getModel("local").setProperty("/Shipments", []);
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

		onResetData: function () {
			this.byId("txtId").setValue("");
			this.getModel("local").setData({
				Shipments: []
			});
		},

		onCrossNavigate: function (oEvent) {
			var shellHash = oEvent.getSource().data("crossNavigate");

			if (!shellHash) {
				return;
			}
			var xnavservice = sap.ushell && sap.ushell.Container && sap.ushell.Container.getService && sap.ushell.Container.getService(
				"CrossApplicationNavigation");
			xnavservice.toExternal({
				target: {
					shellHash: shellHash
				}
			});
		},

		onProofDeliveryPress: function (oEvent) {
			var oTab = this.byId("hierarchyTable");
			var aSelectedIndices = oTab.getSelectedIndices();
			if (aSelectedIndices.length !== 1) {
				MessageBox.warning(this.oBundle.getText("warningSelectOneItem"));
				return;
			}

			var oData = oTab.getRows()[aSelectedIndices[0]].getBindingContext("local").getObject();
			this._getPoD(oData);
		},

		onRowSelectionChange: function (oEvent) {
			var oTab = oEvent.getSource();
			var aIndices = oTab.getSelectedIndices();
			var bFlag = false;
			// Check if any freight unit has tracking number
			aIndices.forEach(function (itemIndex) {
				var oItem = oTab.getRows()[itemIndex];
				var oData = oItem.getBindingContext("local").getObject();
				if (oData.Trackingnum === "") {
					oTab.removeSelectionInterval(itemIndex, itemIndex);
					bFlag = true;
				}
			});
			if (bFlag) {
				MessageBox.warning(this.oBundle.getText("invalidSelection"));
			}
		},

		/* =========================================================== */
		/* internal methods                                            */
		/* =========================================================== */
		_getPoD: function (oData) {
			this.showBusy();
			var sTrackno = oData.Trackingnum;
			this.getModel().callFunction("/GetPODPrint", {
				"method": "GET",
				urlParameters: {
					Station: this.sStation,
					Profile: this.sProfile,
					TrackNo: sTrackno,
				},
				success: function (oData) {
					var aGuids = oData.results;
					aGuids.forEach(function (item) {
						var sPath = this.getModel().sServiceUrl + "/PODPrintSet(Guid='" + item.Guid + "')/$value";
						sap.m.URLHelper.redirect(sPath, true);
					}.bind(this));

					this.hideBusy();
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

		treeify: function (list, idAttr, parentAttr, childrenAttr) {
			if (!idAttr) idAttr = "NodeId";
			if (!parentAttr) parentAttr = "ParentId";
			if (!childrenAttr) childrenAttr = "Children";

			var treeList = [];
			var lookup = {};
			list.forEach(function (obj) {
				lookup[obj[idAttr]] = obj;
				obj[childrenAttr] = [];
			});
			list.forEach(function (obj) {
				if (obj[parentAttr] !== 0) {
					lookup[obj[parentAttr]][childrenAttr].push(obj);
				} else {
					treeList.push(obj);
				}
			});
			return treeList;
		}
	});
});