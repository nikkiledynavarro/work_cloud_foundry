/*global location*/
jQuery.sap.require("com.erpis.shiperp.trackshipmentewm.common.jquery_hotkeys");
sap.ui.define([
	"com/erpis/shiperp/trackshipmentewm/hr7/controller/BaseController",
	"sap/ui/model/json/JSONModel",
	"com/erpis/shiperp/trackshipmentewm/hr7/model/formatter",
	"sap/m/Token",
	"sap/ui/model/Filter",
	"sap/m/MessageBox",
	"sap/m/MessageToast",
	"com/erpis/shiperp/trackshipmentewm/hr7/common/Utils",
	"com/erpis/shiperp/trackshipmentewm/hr7/common/hotkeyInterface",
	"sap/ui/core/MessageType"
], function (BaseController, JSONModel, formatter, Token, Filter, MessageBox, MessageToast, Utils, HotkeyInterface, MessageType) {
	"use strict";

	return BaseController.extend("com.erpis.shiperp.trackshipmentewm.controller.EWM.Main", {

		_oLogger: jQuery.sap.log.getLogger("com.erpis.shiperp.trackshipmentewm.controller.EWM.Main"),
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
				Shipments: [],
				Pagination: {
					ncurrNum: 0,
					nPage: 0,
					Total: 0
				},
				showPagination: false,
				showBackButton: false,
				showNextButton: false,
				PaginationDetail: {
					ncurrNum: 0,
					nPage: 0,
					Total: 0
				},
				showPaginationDetail: false
			});
			this.setModel(oViewModel, "local");
			var oModel = new JSONModel({
				modelData: []
			});
			this.getView().setModel(oModel, "pageModel");

			this.getRouter().getRoute("mainEWM").attachPatternMatched(this._onObjectMatched, this);

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
			this.sWarehouseNumber = oEvent.getParameter("arguments").WarehouseNumber;
			var iStart = window.location.href.indexOf("?trackno=");
			var iEnd = window.location.href.lastIndexOf("&");
			var sTrackno = "";
			if (iEnd !== -1 && iStart !== -1) {
				sTrackno = window.location.href.slice(iStart + "?trackno=".length, iEnd);
			}

			if (sTrackno) {
				this.byId("cbInputType").setSelectedKey("7"); //Tracking Number
				this.byId("txtIdEWM").setValue(sTrackno);
				this.byId("txtIdEWM").fireSubmit();
			} else {
				this.byId("txtIdEWM").setValue("");
			}
			this.byId("txtIdEWM").setEditable(true);
			/* Set Message empty*/
			this.getModel("messageModel").setData({
				aMessages: [],
				messagesLength: 0
			});
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
				this.byId("txtIdEWM").setValueState("Error");
				return;
			} else {
				this.byId("txtIdEWM").setValueState("None");
			}
			this.byId("txtIdEWM").setEditable(false)
			this.sInputID = oEvent.getSource().getValue();
			this.showBusy();
			var oRequestData = this._generateGetTrackDataUsecase();
			this.getModel("EWMService").create("/ShipmentQuerySet", oRequestData, {
				success: function (oData) {
					this.getModel("local").setProperty("/TrackData", oData.TrackDataSet.results);
					if (oData.TrackShipmentSet) {
						this.getModel("local").setProperty("/Shipments", oData.TrackShipmentSet.results);
						var oPageModel = this.getView().getModel("pageModel");
						var nTotalItems = (oData.TrackShipmentSet.results).length;
						this.hideBusy();
						var aListEntries = [];
						if (nTotalItems > 0) {
							this.getModel("local").setProperty("/showPagination", true);
							for (var i = 0; i < nTotalItems; i++) {
								aListEntries.push(i + 1);
							}
							this.getModel("pageModel").setProperty("/modelData", aListEntries);
							if (nTotalItems > 100) {
								oPageModel.setSizeLimit(aListEntries);
							}
							//pagination button
							var iNumSelect = 10;
							if (nTotalItems < 10) {
								iNumSelect = nTotalItems;
							}
							var nTotal = Math.ceil(nTotalItems / iNumSelect);
							this.getModel("local").setProperty("/Pagination", {
								ncurrNum: 1,
								nPage: iNumSelect,
								Total: nTotal
							});
							var aFinalData = [];
							aFinalData = this.handlePagination(oData.TrackShipmentSet.results, iNumSelect, 1);
							this.getModel("local").setProperty("/ShipmentFinalData", aFinalData);
						}
						this.hideBusy();
					}
					if (oData.return && oData.return.results.length > 0) {
						var aMsg = this._generateMessages(oData.return.results);
						this._addMessage(aMsg);
						if (aMsg.length > 0) this.byId('popoverButtonEWM').firePress();
					}
					this.byId("idShipmentDetail").removeSelections();
				}.bind(this),
				error: function (oError) {
					this.getModel("local").setProperty("/Shipments", []);
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

		handlePagination: function (array, page_size, page_number) {
			return array.slice((page_number - 1) * page_size, page_number * page_size);
		},
		onNavBackButtonPress: function () {
			this._handleNavButton("Back");
		},
		onNavNextButtonPress: function () {
			this._handleNavButton("Next");
		},

		onChangeNum: function () {
			this._handleNavButton();
		},

		_handleNavButton: function (sAction) {
			var sPageSize = this.byId("numSelected").getSelectedKey();
			var PageNum = this.getModel("local").getProperty("/Pagination/ncurrNum");
			var aDataCurr = this.getModel("local").getProperty("/Shipments");
			var aFinalData = [];
			if (sAction) {
				if (sAction === "Back") {
					PageNum--;
				} else {
					PageNum++;
				}
				this.getModel("local").setProperty("/Pagination/ncurrNum", PageNum);
				aFinalData = this.handlePagination(aDataCurr, parseInt(sPageSize, 10), PageNum);
			} else {
				var nTotal = Math.ceil(aDataCurr.length / parseInt(sPageSize, 10));
				this.getModel("local").setProperty("/Pagination", {
					ncurrNum: 1,
					nPage: parseInt(sPageSize, 10),
					Total: nTotal
				});
				aFinalData = this.handlePagination(aDataCurr, parseInt(sPageSize, 10), 1);
			}
			this.getModel("local").setProperty("/ShipmentFinalData", aFinalData);
		},

		_generateGetTrackDataUsecase: function () {
			var oData = {
				inputids: (this.sInputID) ? this.sInputID : "",
				inputtype: (this.sInputType) ? this.sInputType : "",
				profile: (this.sProfile) ? this.sProfile : "",
				warehousenum: (this.sWarehouseNumber) ? this.sWarehouseNumber : "",
				shippingstation: (this.sStation) ? this.sStation : "",
				action: "TrackData",
				return: [],
				TrackDataSet: [],
				ShipDataSet: [],
				TrackShipmentSet: []
			};
			return oData;
		},

		onResetData: function () {
			this.byId("txtIdEWM").setValue("");
			this.getModel("local").setData({
				Shipments: []
			});
			this.byId("txtIdEWM").setEditable(true);
			this.getModel("pageModel").setProperty("/modelData", []);
		},

		onCrossNavigate: function (oEvent) {
			var shellHash = oEvent.getSource().data("crossNavigate");
			if (!shellHash) {
				return;
			}
			this._setCookie("AppCancel", "EWM");
			var xnavservice = sap.ushell && sap.ushell.Container && sap.ushell.Container.getService && sap.ushell.Container.getService(
				"CrossApplicationNavigation");
			xnavservice.toExternal({
				target: {
					shellHash: shellHash
				}
			});
		},

		_setCookie: function (sName, sValue) {
			document.cookie = sName + "=" + sValue + ";path=/";
		},

		/* =========================================================== */
		/* internal methods                                            */
		/* =========================================================== */
		_generatePODUsecase: function (sTrackno) {
			var oData = {
				inputids: (this.sInputID) ? this.sInputID : "",
				inputtype: (this.sInputType) ? this.sInputType : "",
				profile: (this.sProfile) ? this.sProfile : "",
				warehousenum: (this.sWarehouseNumber) ? this.sWarehouseNumber : "",
				shippingstation: (this.sStation) ? this.sStation : "",
				action: "POD",
				return: [],
				trackingnum: sTrackno,
				ShipDataSet: [],
				pod: "",
				pod_type: "",
				pod2: "",
				pod2_type: ""
			};
			return oData;
		},
		hexToBase64: function (str) {
			var bString = "";
			for (var i = 0; i < str.length; i += 2) {
				bString += String.fromCharCode(parseInt(str.substr(i, 2), 16));
			}
			return btoa(bString);
		},
		b64toBlob: function (b64Data, contentType, sliceSize) {
			contentType = contentType || '';
			sliceSize = sliceSize || 512;
			var byteCharacters = atob(b64Data);
			var byteArrays = [];
			for (var offset = 0; offset < byteCharacters.length; offset += sliceSize) {
				var slice = byteCharacters.slice(offset, offset + sliceSize);
				var byteNumbers = new Array(slice.length);
				for (var i = 0; i < slice.length; i++) {
					byteNumbers[i] = slice.charCodeAt(i);
				}
				var byteArray = new Uint8Array(byteNumbers);
				byteArrays.push(byteArray);
			}
			var blob = new Blob(byteArrays, {
				type: contentType
			});
			return blob;
		},
		_getPoD: function (sTrackno) {
			this.showBusy();
			var oRequestData = this._generatePODUsecase(sTrackno);
			this.getModel("EWMService").create("/ShipmentQuerySet", oRequestData, {
				success: function (oData) {
					var contentType;
					var blob;
					var fileURL;
					if (oData.return && oData.return.results.length > 0) {
						MessageBox.error(oData.return.results[0].Message);
						this.hideBusy();
						return;
					}
					if (oData.pod_type === "PDF") {
						var convString = this.hexToBase64(oData.pod);
						var b64Data = convString;
						contentType = 'application/pdf';
						blob = this.b64toBlob(b64Data, contentType);
						fileURL = URL.createObjectURL(blob);
						window.open(fileURL);
					} else if (oData.pod2_type === "HTML") {
						contentType = "text/html";
						blob = this.b64toBlob(oData.pod2, contentType);
						fileURL = URL.createObjectURL(blob);
						window.open(fileURL);
					}
					this.hideBusy();
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

		onOpenTrackingStatusDialog: function (oEvent) {
			//call api to get data
			this.showBusy();
			var sText = oEvent.getSource().getBindingContext("local").getObject().trackingnum;
			var oRequestData = this._generateGetTrackStatusUsecase(sText);
			this.getModel("EWMService").create("/ShipmentQuerySet", oRequestData, {
				success: function (oData) {
					this.hideBusy();
					if (oData.TrackDataSet.results.length > 0) {
						this.getModel("local").setProperty("/ShipmentsStatus", oData.TrackDataSet.results);
						this.getModel("local").setProperty("/firstObject", oData.TrackDataSet.results[0]);
						var oModel = new JSONModel({
							shipmentDetail: []
						});
						this.getView().setModel(oModel, "modelDetail");
						var nTotalItems = (oData.TrackDataSet.results).length;
						var aListEntries = [];
						if (nTotalItems > 0) {
							this.getModel("local").setProperty("/showPaginationDetail", true);
							for (var i = 0; i < nTotalItems; i++) {
								aListEntries.push(i + 1);
							}
							this.getModel("modelDetail").setProperty("/shipmentDetail", aListEntries);
							if (nTotalItems > 100) {
								oModel.setSizeLimit(aListEntries);
							}
							//pagination button
							var iNumSelect = 10;
							if (nTotalItems < 10) {
								iNumSelect = nTotalItems;
							}
							var nTotal = Math.ceil(nTotalItems / iNumSelect);
							this.getModel("local").setProperty("/PaginationDetail", {
								ncurrNum: 1,
								nPage: iNumSelect,
								Total: nTotal
							});
							var aFinalData = [];
							aFinalData = this.handlePagination(oData.TrackDataSet.results, iNumSelect, 1);
							this.getModel("local").setProperty("/ShipmentDetailFinalData", aFinalData);
						}
					}
					if (oData.return && oData.return.results.length > 0) {
						var aMsg = this._generateMessages(oData.return.results);
						this._addMessage(aMsg);
						if (aMsg.length > 0) this.byId('popoverButtonEWM').firePress();
					}
					if (!this.oTrackingStatusDialog) {
						this.oTrackingStatusDialog = Utils.getFragment("", "EWM.TrackShipmentDetail", this);
					}
					this.oTrackingStatusDialog.open();
				}.bind(this),
				error: function (oError) {
					this.getModel("local").setProperty("/Shipments", []);
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},
		onButtonClose: function (oEvent) {
			this.oTrackingStatusDialog.close();
		},

		_generateGetTrackStatusUsecase: function (sText) {
			//update payload
			var aTrackData = this._handleDateForTrackData();
			var oData = {
				inputids: (this.sInputID) ? this.sInputID : "",
				inputtype: (this.sInputType) ? this.sInputType : "",
				profile: (this.sProfile) ? this.sProfile : "",
				warehousenum: (this.sWarehouseNumber) ? this.sWarehouseNumber : "",
				shippingstation: (this.sStation) ? this.sStation : "",
				action: "TrackStatus",
				trackingnum: sText,
				return: [],
				TrackDataSet: aTrackData
			};
			return oData;
		},

		_handleDateForTrackData: function () {
			var aTrackData = this.getModel("local").getProperty("/TrackData");
			if (aTrackData && aTrackData.length > 0) {
				for (var i = 0; i < aTrackData.length; i++) {
					aTrackData[i].Pickupdate = aTrackData[i].Pickupdate.replaceAll("-", "");
					aTrackData[i].Datum = aTrackData[i].Datum.replaceAll("-", "");
					aTrackData[i].Deliverydate = aTrackData[i].Deliverydate.replaceAll("-", "");
				}
			}
			return aTrackData;
		},

		onNavBackDetailButtonPress: function () {
			this._handleNavButtonDetail("Back");
		},
		onNavNextDetailButtonPress: function () {
			this._handleNavButtonDetail("Next");
		},

		onChangeNumDetail: function () {
			this._handleNavButtonDetail();
		},

		_handleNavButtonDetail: function (sAction) {
			var sPageSize = this.byId("numSelected1").getSelectedKey();
			var PageNum = this.getModel("local").getProperty("/PaginationDetail/ncurrNum");
			var aDataCurr = this.getModel("local").getProperty("/ShipmentsStatus");
			var aFinalData = [];
			if (sAction) {
				if (sAction === "Back") {
					PageNum--;
				} else {
					PageNum++;
				}
				this.getModel("local").setProperty("/PaginationDetail/ncurrNum", PageNum);
				aFinalData = this.handlePagination(aDataCurr, parseInt(sPageSize, 10), PageNum);
			} else {
				var nTotal = Math.ceil(aDataCurr.length / parseInt(sPageSize, 10));
				this.getModel("local").setProperty("/PaginationDetail", {
					ncurrNum: 1,
					nPage: parseInt(sPageSize, 10),
					Total: nTotal
				});
				aFinalData = this.handlePagination(aDataCurr, parseInt(sPageSize, 10), 1);
			}
			this.getModel("local").setProperty("/ShipmentDetailFinalData", aFinalData);
		},

		//
		onPrintPOD: function () {
			var aSelectedTrackNum = this.byId("idShipmentDetail").getSelectedItems();
			if (aSelectedTrackNum.length !== 1) {
				MessageBox.warning(this.oBundle.getText("warningSelectOneItem"));
				return;
			}
			var sTracknum = aSelectedTrackNum[0].getBindingContext("local").getObject().trackingnum;
			this._getPoD(sTracknum);
		},

		onPrintPODDetail: function () {
			var aTrackStatus = this.getModel("local").getProperty("/ShipmentsStatus");
			if (aTrackStatus && aTrackStatus.length > 0) {
				this._getPoD(aTrackStatus[0].Trackingnum);
			}
		},

		//Handle Message

		_generateMessages: function (aParamMessages) {
			var aMessages = [];
			for (var i = 0; i < aParamMessages.length; i++) {
				var oMessage = this._generateMessageObject(aParamMessages[i]);
				if (oMessage) {
					aMessages.push(oMessage);
				}
			}
			return aMessages;
		},
		_generateMessageObject: function (oPassMessage) {
			var oMessage = {
				type: "Warning",
				title: oPassMessage.Message,
				description: "",
				counter: 0
			};
			switch (oPassMessage.Type) {
			case "E":
				oMessage.type = MessageType.Error;
				break;
			case "W":
				oMessage.type = MessageType.Warning;
				break;
			case "I":
				oMessage.type = MessageType.Information;
				break;
			case "S":
				oMessage.type = MessageType.Success;
				break;
			default:
				oMessage.type = MessageType.Warning;
				break;
			}
			return oMessage;
		},
		_addMessage: function (aMsg) {
			var aMessages = this.getModel("messageModel").getProperty("/aMessages");
			var aNewMessages = aMsg.concat(aMessages);
			this.getModel("messageModel").setProperty("/messagesLength", aNewMessages.length);
			this.getModel("messageModel").setProperty("/aMessages", aNewMessages);
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
				if (obj[parentAttr].trim() !== "0") {
					if (lookup[obj[parentAttr].trim()] && lookup[obj[parentAttr].trim()][childrenAttr]) {
						lookup[obj[parentAttr].trim()][childrenAttr].push(obj);
					}
				} else {
					treeList.push(obj);
				}
			});
			return treeList;
		}
	});
});