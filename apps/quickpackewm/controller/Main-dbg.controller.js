sap.ui.define([
	"sap/ui/core/library",
	"com/erpis/shiperp/hr7/quickpackewm/controller/BaseController",
	"sap/ui/model/json/JSONModel",
	"sap/m/MessageToast",
	"sap/m/Token",
	"sap/ui/core/Fragment",
	"sap/ui/model/Filter",
	"sap/m/MessageBox",
	"com/erpis/shiperp/hr7/quickpackewm/model/formatter",
	"com/erpis/shiperp/hr7/quickpackewm/common/Utils",
	"sap/ui/table/RowSettings",
], function (library, BaseController, JSONModel, MessageToast, Token, Fragment, Filter, MessageBox, formatter,
	Utils, RowSettings) {
	"use strict";
	var MessageType = library.MessageType;

	return BaseController.extend("com.erpis.shiperp.hr7.quickpackewm.controller.Main", {

		/**
		 * @override
		 **/

		oBundle: null,
		formatter: formatter,
		Shipped: false,
		aOriginMasterSerialList: [], // The list contain the data from server.

		onInit: function () {
			this.oBundle = this.getResourceBundle();
			// Local Model for view
			this.getOwnerComponent().setModel(new JSONModel({
				isOnlyOneSelected: false,
				isOnlyOneSelectedTotes: false,
				MasterSerialList: []
			}), "local");
			// Initialize Message Model
			var oMessageModel = new JSONModel({
				aMessages: [],
				messagesLength: 0
			});
			this.setModel(oMessageModel, "messageModel");

			this.getRouter().getRoute("main").attachPatternMatched(this._onObjectMatched, this);
			this.getView().byId("txtId").addValidator(function (args) {
				var text = args.text;
				return new Token({
					key: text,
					text: text
				});
			});
		},

		_onObjectMatched: function (oEvent) {
			this.sStation = oEvent.getParameter("arguments").Station;
			this.sProfile = oEvent.getParameter("arguments").Profile;
			this.sWarehouseNumber = oEvent.getParameter("arguments").WarehouseNumber;
			// Assign Table control
			this.oContentTable = this.byId("tableTotes");
			this.oHUTable = this.byId("tableHU");
			// Binding Storage Bin
			this._getStorageBin();
		},

		/* =========================================================== */
		/* event handlers                                              */
		/* =========================================================== */

		// get StorageBin
		_getStorageBin: function () {
			this.getModel().read("/xSERPERPxCDS_QP_STORAGEBINS", {
				filters: [
					new Filter("Lgnum", "CS", this.sWarehouseNumber),
				],
				success: function (oData) {
					if (oData.results.length !== 0) {
						this.getModel("local").setProperty("/StorageBin", oData.results);
					} else {
						MessageBox.warning(this.oBundle.getText("NoDataFound"));
					}
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
				}.bind(this)
			});
		},

		// Reset button click
		onResetData: function () {
			this.showBusy();
			this.byId("ObjectPageLayout").scrollToSection(this.byId("iconTabPacking").getId());
			setTimeout(this._resetData.bind(this), 1000); //eslint-disable-line
		},

		// Reset whole screen data
		_resetData: function () {
			this.byId("txtId").removeAllTokens();
			// // Enable inputs fields
			this.byId("txtId").setEditable(true);
			this.byId("cbInputType").setEnabled(true);
			this.getModel("local").setData({});
			this.byId("ObjectPageLayout").setShowHeaderContent(false);
			this.byId("ObjectPageLayout").setPreserveHeaderStateOnScroll(false);
			this._getStorageBin();
			this.hideBusy();
		},

		onSubmit: function (oEvent) {
			this.byId("ObjectPageLayout").scrollToSection(this.byId("iconTabPacking").getId());
			if (this.byId("cbInputType").getSelectedKey() !== "") {
				this.sInputType = this.byId("cbInputType").getSelectedKey();
				this.byId("cbInputType").setValueState("None");
			} else {
				MessageBox.error(this.oBundle.getText("missingInputType"));
				this.byId("cbInputType").setValueState("Error");
				return;
			}

			if (oEvent.getSource().getTokens().length === 0 && oEvent.getSource().getValue() === "") {
				MessageBox.error(this.oBundle.getText("missingInputID"));
				this.byId("txtId").setValueState("Error");
				return;
			} else {
				this.byId("txtId").setValueState("None");
			}

			this.sInputIDs = "";
			if (oEvent.getSource().getTokens().length > 0) {
				for (var i = 0; i < oEvent.getSource().getTokens().length; i++) {
					var sTokenValue = oEvent.getSource().getTokens()[i].getText();
					this.sInputIDs += sTokenValue + ",";
				}
			} else if (oEvent.getSource().getValue() !== "") {
				this.sInputIDs = oEvent.getSource().getValue();
			} else {
				MessageBox.error(this.oBundle.getText("submitDocNo"));
				return;
			}
			this.showBusy();
			this.getModel().read("/QuickPackQuerySet", {
				filters: [
					new Filter("lgNum", "EQ", this.sWarehouseNumber),
					new Filter("shipStation", "EQ", this.sStation),
					new Filter("profile", "EQ", this.sProfile),
					new Filter("inputType", "EQ", this.sInputType),
					new Filter("inputID", "EQ", this.sInputIDs)
				],
				urlParameters: {
					"$expand": "handlingUnits/huPackDetails,handlingUnits/packageLevelOption,serial/serialItems,huPack,totes,return"
				},
				success: function (oData) {
					var oMaterial = {};
					var aMaterials = [];
					if (oData.results.length !== 0) {
						var oDataResult = oData.results[0];
						this.getModel("local").setProperty("/batchNo", true);
						//Enable handling units process
						this.getModel("local").setProperty("/general", oDataResult.general);
						this.getModel("local").setProperty("/HUs", oDataResult.handlingUnits.results);
						this.getModel("local").setProperty("/Contents", oDataResult.totes.results);
						this.getModel("local").setProperty("/MasterSerialList", oDataResult.serial.results);
						this.aOriginMasterSerialList = jQuery.extend(true, [], oDataResult.serial.results);
						this.byId("txtId").setEditable(false);
						this.byId("cbInputType").setEnabled(false);
						if (oDataResult.displaySerial) {
							this._SerialDialog();
						}
						if (oDataResult.return.results.length > 0) {
							var aMsg = this._generateMessages(oDataResult.return.results);
							this._addMessage(aMsg);
							if (aMsg.length > 0) this.byId('popoverButton').firePress();
						}
					} else {
						MessageBox.warning(this.oBundle.getText("NoDataFound"));
						// Enable inputs fields
						this.byId("txtId").setEditable(true);
						this.byId("cbInputType").setEnabled(true);
					}
					this.hideBusy();
				}.bind(this),
				error: function (oError) {
					this.byId("txtId").setEditable(true);
					this.byId("cbInputType").setEnabled(true);
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

		// Create Shipment quickpack
		onExecute: function () {
			var aSelectedHUs = this.oHUTable.getSelectedItems();
			if (aSelectedHUs.length !== 1) {
				MessageBox.error(this.oBundle.getText("errorMPSSelectMsg"));
				return;
			}
			this._execute("");
		},

		_execute: function (sValue) {
			var oRequestData = this._generateCreateShipmentUsecase(sValue);
			this.showBusy();
			this.getModel().create("/QuickPackQuerySet", oRequestData, {
				success: function (oData) {
					if (oData.handlingUnits) {
						this.getModel("local").setProperty("/HUs", oData.handlingUnits.results);
					} else {
						this.getModel("local").setProperty("/HUs", []);
					}
					if (oData.totes) {
						this.getModel("local").setProperty("/Contents", oData.totes.results);
					} else {
						this.getModel("local").setProperty("/Contents", []);
					}
					if (oData.displayTrackPro) {
						if (!this.oDialogLTL) {
							this.oDialogLTL = sap.ui.xmlfragment("com.erpis.shiperp.hr7.quickpackewm.fragment.CreateProNumber", this);
							this.getView().addDependent(this.oDialogLTL);
						}
						this.oDialogLTL.open();
					}
					if (oData.displaySerial) {
						this._SerialDialog();
					}
					if (oData.return.results.length > 0) {
						var aMsg = this._generateMessages(oData.return.results);
						this._addMessage(aMsg);
						if (aMsg.length > 0) this.byId('popoverButton').firePress();
					}
					this.hideBusy();
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

		_generateCreateShipmentUsecase: function (sValue) {
			var aContent = this.getModel("local").getProperty("/Contents");
			var aHUs = this.getModel("local").getProperty("/HUs");
			var oData = {
				general: this.getModel("local").getProperty("/general"),
				lgNum: this.sWarehouseNumber,
				shipStation: this.sStation,
				profile: this.sProfile,
				inputType: this.sInputType,
				inputID: this.sInputIDs,
				displaySerial: false,
				displayTrackPro: false,
				trackPro: sValue ? sValue : "",
				return: [],
				totes: (aContent) ? aContent : [],
				action: "CreateShipment",
				handlingUnits: (aHUs) ? aHUs : []
			};
			return oData;
		},

		onAcceptNumber: function () {
			var sValue = sap.ui.getCore().byId("txtLTL").getValue();
			this._execute(sValue);
			this.oDialogLTL.close();
		},

		onCloseProNumber: function () {
			this.oDialogLTL.close();
		},
		/**** Serial ****/
		onSerialPress: function () {
			if (!this.oSerialDialog) {
				this.oSerialDialog = sap.ui.xmlfragment("com.erpis.shiperp.hr7.quickpackewm.fragment.SerialDialog", this);
				this.getView().addDependent(this.oSerialDialog);
			}

			this.aFreightUnitShippedItems = this._getShippedItems();
			var oCarousel = sap.ui.getCore().byId("serialCarousel");
			var oPages = oCarousel.getPages();
			if (oPages.length > 0) {
				oCarousel.setActivePage(oPages[0]);
				oCarousel.firePageChanged({
					newActivePageId: oPages[0].getId()
				});
			}

			this.oSerialDialog.open();
		},

		onCloseSerialDialog: function () {
			// reset serial list to origin
			this.getModel("local").setProperty("/MasterSerialList", jQuery.extend(true, [], this.aOriginMasterSerialList));
			this.oSerialDialog.close();
		},

		_SerialDialog: function () {
			if (!this.oSerialDialog) {
				this.oSerialDialog = sap.ui.xmlfragment("com.erpis.shiperp.hr7.quickpackewm.fragment.SerialDialog", this);
				this.getView().addDependent(this.oSerialDialog);
			}

			sap.ui.getCore().byId("txtMulId").addValidator(function (args) {
				var text = args.text.trim();
				return new Token({
					key: text,
					text: text
				});
			});

			this.aFreightUnitShippedItems = this._getShippedItems();
			var oCarousel = sap.ui.getCore().byId("serialCarousel");
			var oPages = oCarousel.getPages();
			if (oPages.length > 0) {
				oCarousel.setActivePage(oPages[0]);
				oCarousel.firePageChanged({
					newActivePageId: oPages[0].getId()
				});
			}
			this.oSerialDialog.open();
		},

		onPostSerialsPress: function () {
			var oRequestData = this._generatePostSerialsUsecase();
			this.showBusy();
			this.getModel().create("/QuickPackQuerySet", oRequestData, {
				success: function (oData) {
					// Update serial list
					this.getModel("local").setProperty("/MasterSerialList", oData.serial.results);
					// update origin serial list
					this.aOriginMasterSerialList = jQuery.extend(true, [], oData.serial.results);
					this.oSerialDialog.close();
					if (oData.return.results.length > 0) {
						var aMsg = this._generateMessages(oData.return.results);
						this._addMessage(aMsg);
						if (aMsg.length > 0) this.byId('popoverButton').firePress();
					} else {
						MessageToast.show(this.oBundle.getText("serialpostsuccess"));
					}
					this.hideBusy();
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},
		_generatePostSerialsUsecase: function () {
			var aMasterList = this.getModel("local").getProperty("/MasterSerialList");
			var aSerialData = aMasterList.map(function (item) {
				var newItem = Object.assign({}, item);
				newItem.serialItems = {
					results: item.serialItems.results.map(function (result) {
						var newResult = {};
						for (var key in result) {
							if (result.hasOwnProperty(key) && key !== "tokens") {
								newResult[key] = result[key];
							}
						}
						return newResult;
					})
				};
				return newItem;
			});

			var aHUs = this.getModel("local").getProperty("/HUs");
			var aContent = this.getModel("local").getProperty("/Contents");
			var oData = {
				general: this.getModel("local").getProperty("/general"),
				lgNum: this.sWarehouseNumber,
				shipStation: this.sStation,
				profile: this.sProfile,
				inputType: this.sInputType,
				inputID: this.sInputIDs,
				return: [],
				totes: (aContent) ? aContent : [],
				action: "PostSerial",
				serial: aSerialData,
				handlingUnits: (aHUs) ? aHUs : []
			};
			return oData;
		},

		_getShippedItems: function () {
			var aShippedItems = [];
			var aContexts = this.oHUTable.getBinding("rows").getContexts();
			aContexts.forEach(function (oContext) {
				var oItemData = oContext.getObject();
				if (oItemData.trackingNumber && oItemData.trackingNumber !== "") {
					if (oItemData.FreightunitItems && Array.isArray(oItemData.FreightunitItems.results)) {
						aShippedItems.push.apply(aShippedItems, oItemData.FreightunitItems.results);
					}
				}
			});
			return aShippedItems;
		},

		onSerialItemChange: function (oEvent) {
			var sActivePageId = oEvent.getParameter("newActivePageId");
			var oActivePage = sap.ui.getCore().byId(sActivePageId);
			var oData = oActivePage.getBindingContext("local").getObject();
			this._displaySerialList(oData);
		},

		_displaySerialList: function (oSelectedSerialMaster) {
			// add more item
			if (oSelectedSerialMaster.serialItems.results.length < parseInt(oSelectedSerialMaster.quantity, 10)) {
				var iNumberItemToAdd = parseInt(oSelectedSerialMaster.quantity, 10) - parseInt(oSelectedSerialMaster.serialCount, 10);

				for (var i = 0; i < iNumberItemToAdd; i++) {
					var oSerial = {
						sernr: "",
						posnr: oSelectedSerialMaster.itemNo,
						vbeln: oSelectedSerialMaster.docNo,
						shipmentid: "",
						tokens: []
					};
					oSelectedSerialMaster.serialItems.results.push(oSerial);
				}
			}
			this.getModel("local").setProperty("/SelectedSerial", oSelectedSerialMaster);
		},
		onAddEventSerialScan: function (oEvent) {
			var oControl = oEvent.getSource();
			if (!this.ScanInputEventCheck[oControl.getId()]) {
				oControl.addEventDelegate({
					onsapfocusleave: this.onChangeSerialInputText.bind(this)
				});
				this.ScanInputEventCheck[oControl.getId()] = true;
			}
		},

		onChangeSerialInputText: function (oEvent) {
			var oControl = oEvent.getSource();
			var aTokens = oControl.getTokens();
			if (!aTokens.length) return;

			var oModel = this.getModel("local");
			var aSerialList = oModel.getProperty("/SelectedSerial/serialItems/results") || [];
			// Get all existing serials to check for duplicates
			var aAllSerials = [];
			aSerialList.forEach(function (oItem) {
				oItem.posnr = oItem.posnr.toString();
				if (oItem.sernr) {
					aAllSerials = aAllSerials.concat(oItem.sernr.split(",").map(function (s) {
						return s.trim();
					}));
				}
				if (oItem.tokens) {
					oItem.tokens.forEach(function (t) {
						aAllSerials.push(t.Key);
					});
				}
			});
			// Get new serial list from MultiInput
			var aNewSerials = aTokens.map(function (t) {
				return t.getText().trim();
			});

			// Check for duplicates
			for (var i = 0; i < aNewSerials.length; i++) {
				if (aAllSerials.includes(aNewSerials[i])) {
					var sMsg = this.oBundle.getText("duplicateSerial", [aNewSerials[i]]);
					MessageBox.error(sMsg);
					return;
				}
			}
			// Distribute serial to lines that do not have enough
			var iTokenIndex = 0;
			for (var i = 0; i < aSerialList.length && iTokenIndex < aNewSerials.length; i++) {
				var oItem = aSerialList[i];
				if (!oItem.sernr) {
					var aAssigned = [];

					while (iTokenIndex < aNewSerials.length) {
						var sSerial = aNewSerials[iTokenIndex];
						oItem.tokens.push({
							key: sSerial,
							text: sSerial
						});
						aAssigned.push(sSerial);
						iTokenIndex++;
					}
					// Concatenate strings for sernr
					oItem.sernr = aAssigned.join(", ");
				}
			}

			oModel.setProperty("/SelectedSerial/serialItems/results", aSerialList);
			oControl.removeAllTokens();
		},

		_onCheckCountCreate: function (aSerialCount) {
			var serialCount = 0;
			for (var i = 0; i < aSerialCount.length; i++) {
				aSerialCount[i].serialItems.results.forEach(function (items) {
					if (items.sernr !== "") {
						serialCount++;
					}
				});
				aSerialCount[i].serialCount = String(serialCount);
				serialCount = 0;
			}
			this.getModel("local").setProperty("/MasterSerialList", aSerialCount);
		},

		onLiveChangeAddSerial: function (oEvent) {
			var oInput = oEvent.getSource();
			var sValue = oEvent.getParameter("value");
			// check for spaces and commas 
			if (sValue.endsWith(",") || sValue.endsWith(" ")) {
				var aTokens = oInput.getTokens();
				var sTocken = sValue.trim().replace(/,$/, "");
				// add tocken
				if (sTocken) {
					oInput.addToken(new Token({
						key: sTocken,
						text: sTocken
					}));
				}
				oInput.setValue("");
			}
		},

		onNavigationShipmentDetails: function (oEvent) {
			this.getRouter().navTo("shipmentdetails", {
				Station: this.sStation,
				Profile: this.sProfile,
				WarehouseNumber: this.sWarehouseNumber,
				InputType: this.sInputType,
				InputID: this.sInputIDs
			});
		},

		/* Packaging Material */
		onValidatePackagingMaterial: function () {
			var oRequestData = this._generateValidateFieldUsecase();
			this.showBusy();
			this.getModel().create("/QuickPackQuerySet", oRequestData, {
				success: function (oData) {
					if (oData.handlingUnits) {
						this.getModel("local").setProperty("/HUs", oData.handlingUnits.results);
					} else {
						this.getModel("local").setProperty("/HUs", []);
					}
					if (oData.totes) {
						this.getModel("local").setProperty("/Contents", oData.totes.results);
					} else {
						this.getModel("local").setProperty("/Contents", []);
					}
					if (oData.return.results.length > 0) {
						var aMsg = this._generateMessages(oData.return.results);
						this._addMessage(aMsg);
						if (aMsg.length > 0) this.byId('popoverButton').firePress();
					}
					this.hideBusy();
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},
		_generateValidateFieldUsecase: function () {
			var aToteList = this.getModel("local").getProperty("/Contents");
			var aHUList = this.getModel("local").getProperty("/HUs");
			var oData = {
				general: this.getModel("local").getProperty("/general"),
				lgNum: this.sWarehouseNumber,
				shipStation: this.sStation,
				profile: this.sProfile,
				inputType: this.sInputType,
				inputID: this.sInputIDs,
				return: [],
				totes: (aToteList) ? aToteList : [],
				action: "ValidatePackagingMaterial",
				serial: [],
				handlingUnits: (aHUList) ? aHUList : []
			};
			return oData;
		},
		/* Storage Bin */
		onValidateStorageBin: function () {
			var oRequestData = this._generateValidateStorageBinUsecase();
			this.showBusy();
			this.getModel().create("/QuickPackQuerySet", oRequestData, {
				success: function (oData) {
					if (oData.handlingUnits) {
						this.getModel("local").setProperty("/HUs", oData.handlingUnits.results);
					} else {
						this.getModel("local").setProperty("/HUs", []);
					}
					if (oData.totes) {
						this.getModel("local").setProperty("/Contents", oData.totes.results);
					} else {
						this.getModel("local").setProperty("/Contents", []);
					}
					if (oData.return.results.length > 0) {
						var aMsg = this._generateMessages(oData.return.results);
						this._addMessage(aMsg);
						if (aMsg.length > 0) this.byId('popoverButton').firePress();
					}
					this.hideBusy();
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},
		_generateValidateStorageBinUsecase: function () {
			var aToteList = this.getModel("local").getProperty("/Contents");
			var aHUList = this.getModel("local").getProperty("/HUs");
			var oData = {
				general: this.getModel("local").getProperty("/general"),
				lgNum: this.sWarehouseNumber,
				shipStation: this.sStation,
				profile: this.sProfile,
				inputType: this.sInputType,
				inputID: this.sInputIDs,
				return: [],
				totes: (aToteList) ? aToteList : [],
				action: "ValidateInput",
				serial: [],
				handlingUnits: (aHUList) ? aHUList : []
			};
			return oData;
		},
		/* Material Number */
		onValidateMaterialNumber: function () {
			// var sSelectedKey = oEvent.getSource().getValue().trim();
			var oRequestData = this._generateValidateMaterialNumberUsecase();
			this.showBusy();
			this.getModel().create("/QuickPackQuerySet", oRequestData, {
				success: function (oData) {
					if (oData.handlingUnits) {
						this.getModel("local").setProperty("/HUs", oData.handlingUnits.results);
					} else {
						this.getModel("local").setProperty("/HUs", []);
					}
					if (oData.totes) {
						this.getModel("local").setProperty("/Contents", oData.totes.results);
					} else {
						this.getModel("local").setProperty("/Contents", []);
					}
					// Material popup screen
					if (oData.totesPopup.results.length > 0) {
						var bHasBatchNo = oData.totesPopup.results.some(function (item) {
							return item.batchNo && item.batchNo.trim() !== "";
						});
						this.getModel("local").setProperty("/batchNo", bHasBatchNo);
						this.getModel("local").setProperty("/MaterialsList", oData.totesPopup.results);
						if (!this.oMaterialsDialog) {
							this.oMaterialsDialog = Utils.getFragment("", "packing.MaterialsDialog", this);
						}
						this.oMaterialsDialog.open();
					}
					if (oData.return.results.length > 0) {
						var aMsg = this._generateMessages(oData.return.results);
						this._addMessage(aMsg);
						if (aMsg.length > 0) this.byId('popoverButton').firePress();
					}
					this.hideBusy();
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},
		_generateValidateMaterialNumberUsecase: function () {
			var aToteList = this.getModel("local").getProperty("/Contents");
			var aHUList = this.getModel("local").getProperty("/HUs");
			var oData = {
				general: this.getModel("local").getProperty("/general"),
				lgNum: this.sWarehouseNumber,
				shipStation: this.sStation,
				profile: this.sProfile,
				inputType: this.sInputType,
				inputID: this.sInputIDs,
				return: [],
				totes: (aToteList) ? aToteList : [],
				totesPopup: [],
				action: "ValidateMaterial",
				serial: [],
				handlingUnits: (aHUList) ? aHUList : []
			};
			return oData;
		},
		/* Batch Number */
		onValidateBatchNumber: function () {
			var oRequestData = this._generateValidateBatchNumberUsecase();
			this.showBusy();
			this.getModel().create("/QuickPackQuerySet", oRequestData, {
				success: function (oData) {
					if (oData.handlingUnits) {
						this.getModel("local").setProperty("/HUs", oData.handlingUnits.results);
					} else {
						this.getModel("local").setProperty("/HUs", []);
					}
					if (oData.totes) {
						this.getModel("local").setProperty("/Contents", oData.totes.results);
					} else {
						this.getModel("local").setProperty("/Contents", []);
					}
					// Material popup screen
					if (oData.totesPopup.results.length > 0) {
						this.getModel("local").setProperty("/MaterialsList", oData.totesPopup.results);
						if (!this.oMaterialsDialog) {
							this.oMaterialsDialog = Utils.getFragment("", "packing.MaterialsDialog", this);
						}
						this.oMaterialsDialog.open();
					}
					if (oData.return.results.length > 0) {
						var aMsg = this._generateMessages(oData.return.results);
						this._addMessage(aMsg);
						if (aMsg.length > 0) this.byId('popoverButton').firePress();
					}
					this.hideBusy();
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},
		_generateValidateBatchNumberUsecase: function () {
			var aToteList = this.getModel("local").getProperty("/Contents");
			var aHUList = this.getModel("local").getProperty("/HUs");
			var oData = {
				general: this.getModel("local").getProperty("/general"),
				lgNum: this.sWarehouseNumber,
				shipStation: this.sStation,
				profile: this.sProfile,
				inputType: this.sInputType,
				inputID: this.sInputIDs,
				return: [],
				totes: (aToteList) ? aToteList : [],
				action: "ValidateBatchNumber",
				serial: [],
				totesPopup: [],
				handlingUnits: (aHUList) ? aHUList : []
			};
			return oData;
		},

		/* Quantity */
		onValidateQuantity: function () {
			var oRequestData = this._generateValidateQuantityUsecase();
			this.showBusy();
			this.getModel().create("/QuickPackQuerySet", oRequestData, {
				success: function (oData) {
					if (oData.handlingUnits) {
						this.getModel("local").setProperty("/HUs", oData.handlingUnits.results);
					} else {
						this.getModel("local").setProperty("/HUs", []);
					}
					if (oData.totes) {
						this.getModel("local").setProperty("/Contents", oData.totes.results);
					} else {
						this.getModel("local").setProperty("/Contents", []);
					}
					if (oData.return.results.length > 0) {
						var aMsg = this._generateMessages(oData.return.results);
						this._addMessage(aMsg);
						if (aMsg.length > 0) this.byId('popoverButton').firePress();
					}
					this.hideBusy();
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},
		_generateValidateQuantityUsecase: function () {
			var aToteList = this.getModel("local").getProperty("/Contents");
			var aHUList = this.getModel("local").getProperty("/HUs");
			var oData = {
				general: this.getModel("local").getProperty("/general"),
				lgNum: this.sWarehouseNumber,
				shipStation: this.sStation,
				profile: this.sProfile,
				inputType: this.sInputType,
				inputID: this.sInputIDs,
				return: [],
				totes: (aToteList) ? aToteList : [],
				action: "ValidateQuantity",
				serial: [],
				handlingUnits: (aHUList) ? aHUList : []
			};
			return oData;
		},
		/* Item	Barcode */
		onValidateBarcode: function (oEvent) {
			this.showBusy();
			var aMaterials = [];
			var sSelectedKey = oEvent.getSource().getValue().trim();
			var oRequestData = this._generateValidateBarcodeUsecase();
			this.getModel().create("/QuickPackQuerySet", oRequestData, {
				success: function (oData) {
					this.getModel("local").setProperty("/general", oData.general);
					if (oData.handlingUnits) {
						this.getModel("local").setProperty("/HUs", oData.handlingUnits.results);
					} else {
						this.getModel("local").setProperty("/HUs", []);
					}
					if (oData.totes) {
						this.getModel("local").setProperty("/Contents", oData.totes.results);
					} else {
						this.getModel("local").setProperty("/Contents", []);
					}
					if (oData.totesPopup.results.length > 0) {
						this.getModel("local").setProperty("/MaterialsList", oData.totesPopup.results);
						if (!this.oMaterialsDialog) {
							this.oMaterialsDialog = Utils.getFragment("", "packing.MaterialsDialog", this);
						}
						this.oMaterialsDialog.open();
					}
					if (oData.return.results.length > 0) {
						var aMsg = this._generateMessages(oData.return.results);
						this._addMessage(aMsg);
						if (aMsg.length > 0) this.byId('popoverButton').firePress();
					}
					this.hideBusy();
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

		_generateValidateBarcodeUsecase: function () {
			var aContents = this.getModel("local").getProperty("/Contents");
			var aHandlingUnits = this.getModel("local").getProperty("/HUs");
			var oData = {
				general: this.getModel("local").getProperty("/general"),
				lgNum: this.sWarehouseNumber,
				shipStation: this.sStation,
				profile: this.sProfile,
				inputType: this.sInputType,
				inputID: this.sInputIDs,
				return: [],
				totes: (aContents) ? aContents : [],
				totesPopup: [],
				action: "ValidateBarcode",
				serial: [],
				handlingUnits: (aHandlingUnits) ? aHandlingUnits : []
			};
			return oData;
		},
		onValidateNumber: function (oEvent) {
			var sNewValue = oEvent.getParameter("newValue");
			var sBalance = oEvent.getSource().getBindingContext("local").getObject().balance;
			if (parseInt(sNewValue, 10) > parseInt(sBalance, 10)) {
				oEvent.getSource().setValueState("Error");
				MessageBox.error(this.oBundle.getText("partialQuantityError"));
			} else {
				oEvent.getSource().getBindingContext("local").getObject().partialQty = parseFloat(sNewValue, 10).toFixed(3);
				oEvent.getSource().setValueState("None");
			}
		},

		onCloseMaterial: function () {
			this.oMaterialsDialog.close();
		},

		onSelectionChangeMaterial: function () {
			var oRequestData = this._generateMaterialsUsecase();
			this.showBusy();
			this.getModel().create("/QuickPackQuerySet", oRequestData, {
				success: function (oData) {
					this.getModel("local").setProperty("/general", oData.general);
					if (oData.handlingUnits.results.length > 0) {
						this.getModel("local").setProperty("/HUs", oData.handlingUnits.results);
					} else {
						this.getModel("local").setProperty("/HUs", []);
					}
					if (oData.totes.results.length > 0) {
						this.getModel("local").setProperty("/Contents", oData.totes.results);
					} else {
						this.getModel("local").setProperty("/Contents", []);
					}
					if (oData.return.results.length > 0) {
						var aMsg = this._generateMessages(oData.return.results);
						this._addMessage(aMsg);
						if (aMsg.length > 0) this.byId('popoverButton').firePress();
					}
					this.oMaterialsDialog.close();
					this.hideBusy();
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

		_generateMaterialsUsecase: function (aMaterials) {
			var aMaterials = this.getModel("local").getProperty("/MaterialsList");
			var aContent = this.getModel("local").getProperty("/Contents");
			var aHandlingUnits = this.getModel("local").getProperty("/HUs");
			//Set Flag
			var oData = {
				general: this.getModel("local").getProperty("/general"),
				lgNum: this.sWarehouseNumber,
				shipStation: this.sStation,
				profile: this.sProfile,
				inputType: this.sInputType,
				inputID: this.sInputIDs,
				return: [],
				totes: (aContent) ? aContent : [],
				totesPopup: (aMaterials) ? aMaterials : [],
				action: "ValidateMaterial",
				handlingUnits: (aHandlingUnits) ? aHandlingUnits : []
			};
			return oData;
		},

		/**************************** Handling Unit Process ****************************/
		onUpdateFinishedTotes: function () {
			var oTable = this.byId("tableTotes");
			var oBinding = oTable.getBinding("rows");
			if (!oBinding) {
				return;
			}
			var aContexts = oBinding.getContexts(0, oBinding.getLength());
			aContexts.forEach(function (oContext, iIndex) {
				var sSel = oContext.getProperty("sel");
				if (sSel === "X") {
					oTable.addSelectionInterval(iIndex, iIndex);
				} else {
					oTable.removeSelectionInterval(iIndex, iIndex);
				}
			});
		},

		onUpdateFinishedHandlingUnits: function () {
			var oTable = this.byId("tableHU");
			var aIndices = oTable.getSelectedIndices();
			var aSelectedContexts = aIndices.map(function (iIndex) {
				return oTable.getContextByIndex(iIndex);
			});
			this._updateShippingStatus(aSelectedContexts);
		},

		onSelectionChangeHandlingUnits: function (oEvent) {
			var oModel = this.getModel("local");
			var aIndicesHandlingUnits = this.byId("tableHU").getSelectedIndices();
			var aIndicesTotes = this.byId("tableTotes").getSelectedIndices();
			var aSelectedContexts = aIndicesHandlingUnits.map(function (iIndex) {
				return oEvent.getSource().getContextByIndex(iIndex);
			});
			var aSelectedKeys = aSelectedContexts.map(function (oItem) {
				return oItem.getObject().outbHu;
			});
			var aHUs = oModel.getProperty("/HUs") || [];
			var aUpdated = aHUs.map(function (oHU) {
				oHU.sel = aSelectedKeys.includes(oHU.outbHu) ? 'X' : '';
				return oHU;
			});
			oModel.setProperty("/HUs", aUpdated);
			var bTrackingNo = aHUs.find(function (res) {
				return aSelectedKeys.includes(res.outbHu) && res.trackingNumber && res.trackingNumber !== "";
			});
			if (!bTrackingNo) {
				var isTotesAndHUs = aIndicesTotes.length > 0 && aIndicesHandlingUnits.length > 0;
				var isOnlyHUs = !aIndicesTotes.length > 0 && aIndicesHandlingUnits.length > 0;
				oModel.setProperty("/isOnlyOneSelectedTotes", isTotesAndHUs);
				oModel.setProperty("/isOnlyOneSelected", isTotesAndHUs || isOnlyHUs);
			} else {
				oModel.setProperty("/isOnlyOneSelectedTotes", false);
				oModel.setProperty("/isOnlyOneSelected", false);
			}
		},

		onSelectionChangeTotes: function (oEvent) {
			var oTableTotes = this.byId("tableTotes");
			var oTableHU = this.byId("tableHU");
			var aSelectedContexts = oTableTotes.getSelectedIndices().map(function (iIndex) {
				return oTableTotes.getContextByIndex(iIndex);
			});

			var aSelectedGuids = aSelectedContexts.map(function (oContext) {
				return oContext.getObject().guidStock;
			});

			var aToteList = this.getModel("local").getProperty("/Contents") || [];
			aToteList.forEach(function (oTote) {
				oTote.sel = aSelectedGuids.includes(oTote.guidStock) ? 'X' : '';
			});

			this.getModel("local").setProperty("/Contents", aToteList);

			if (oTableTotes.getSelectedIndices().length > 0 && oTableHU.getSelectedIndices().length > 0) {
				this.getModel("local").setProperty("/isOnlyOneSelectedTotes", true);
			} else {
				this.getModel("local").setProperty("/isOnlyOneSelectedTotes", false);
			}
		},

		onRowSelectionChange: function (oEvent) {
			var oTable = oEvent.getSource();
			var aSelectedContexts = oTable.getSelectedIndices().map(function (iIndex) {
				return oTable.getContextByIndex(iIndex);
			});

			var aSelectedGuids = aSelectedContexts.map(function (oContext) {
				return oContext.getObject().guidStock;
			});

			var aMaterialsList = this.getModel("local").getProperty("/MaterialsList") || [];
			aMaterialsList.forEach(function (obj) {
				obj.sel = aSelectedGuids.includes(obj.guidStock) ? 'X' : '';
			});

			this.getModel("local").setProperty("/MaterialsList", aMaterialsList);
		},

		onUpdateFinishedMaterials: function (oEvent) {
			oEvent.getSource().clearSelection();
		},

		onOverpacking: function (oEvent) {
			var aHUs = this.getModel("local").getProperty("/HUs");
			var aSelectedIndices = this.oHUTable.getSelectedIndices();
			var aSelectedHUs = aSelectedIndices.map(function (iIndex) {
				return this.oHUTable.getContextByIndex(iIndex);
			}, this);

			// Extract selected "outbHu" values
			var aSelectedoutbHu = aSelectedHUs.map(function (oItem) {
				return oItem.getBindingContext("local").getObject().outbHu;
			});

			// Filter HUs to find unselected ones
			var aUnselectedHUs = aHUs.filter(function (oHU) {
				return !aSelectedoutbHu.includes(oHU.outbHu);
			});

			this.getModel("local").setProperty("/UnSelectdHUs", aUnselectedHUs);

			if (!this.oOverpackDialog) {
				this.oOverpackDialog = sap.ui.xmlfragment("com.erpis.shiperp.hr7.quickpackewm.fragment.packing.OverpackDialog", this);
				this.getView().addDependent(this.oOverpackDialog);
			}
			this.oOverpackDialog.open();
		},

		onCloseOverpack: function () {
			this.oOverpackDialog.close();
		},

		onAcceptOverpack: function () {
			this.showBusy();
			var aHandlingUnits = this.getModel("local").getProperty("/HUs");
			var aSelectedIndices = this.oHUTable.getSelectedIndices();
			var aSelectedContexts = aSelectedIndices.map(function (iIndex) {
				return this.oHUTable.getContextByIndex(iIndex);
			}, this);

			aHandlingUnits.forEach(function (object) {
				var isSelected = aSelectedContexts.some(function (item) {
					var oItemData = item.getBindingContext("local").getObject();
					return object.outbHu === oItemData.outbHu;
				});

				object.sel = isSelected ? "X" : "";
			});

			var oRequestData = this._generateOverpackingUsecase(aHandlingUnits);
			this.getModel().create("/QuickPackQuerySet", oRequestData, {
				success: function (oData) {
					if (oData.handlingUnits) {
						this.getModel("local").setProperty("/HUs", oData.handlingUnits.results);
					} else {
						this.getModel("local").setProperty("/HUs", []);
					}
					if (oData.return.results.length > 0) {
						var aMsg = this._generateMessages(oData.return.results);
						this._addMessage(aMsg);
						if (aMsg.length > 0) this.byId('popoverButton').firePress();
					}

					this.oOverpackDialog.close();
					this.hideBusy();
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

		_generateOverpackingUsecase: function (aHandlingUnits) {
			var sTargetHu = sap.ui.getCore().byId("MulTargetHU").getSelectedItem().getBindingContext("local").getObject().outbHu;
			var oData = {
				general: this.getModel("local").getProperty("/general"),
				lgNum: this.sWarehouseNumber,
				shipStation: this.sStation,
				profile: this.sProfile,
				inputType: this.sInputType,
				inputID: this.sInputIDs,
				return: [],
				totes: [],
				action: "Overpack",
				targetHu: sTargetHu,
				handlingUnits: (aHandlingUnits) ? aHandlingUnits : []
			};
			return oData;
		},

		onOpenPackingOverviewDialog: function (oEvent) {
			this.aSelectedHUs = oEvent.getSource().getBindingContext("local").getObject();
			var oHUDetails = JSON.parse(JSON.stringify(this.aSelectedHUs));
			//calling packing overview
			this._showPackingOverview(parseInt(oHUDetails.outbHu, 10), oHUDetails.huPackDetails.results);
		},

		_showPackingOverview: function (sHU, oHUDetail) {
			this.showBusy();
			var arrHuPack = [];
			// filter root Handling units
			oHUDetail.filter(function (item) {
				if (parseInt(item.handlingUnit, 10) === sHU) {
					if (item.parentHU.trim() === '') {
						arrHuPack.push(item);
					}
				}
			});
			// filter Parent Handling units
			var aHUs = oHUDetail.filter(function (item) {
				return parseInt(item.parentHU, 10) === sHU;
			});

			var aParentHUs = oHUDetail.filter(function (item) {
				return aHUs.some(function (itemChild) {
					return itemChild.handlingUnit.trim() === item.parentHU.trim();
				});
			});
			aHUs.forEach(function (item) {
				arrHuPack.push(item);
				var findChild = aParentHUs.find(function (itemChild) {
					return itemChild.parentHU && item && item.handlingUnit && itemChild.parentHU.trim() === item.handlingUnit.trim();
				});
				if (findChild && !arrHuPack.includes(findChild)) {
					arrHuPack.push(findChild);
				}
			});

			var aHuPackDetail = this.getModel("local").getProperty("/HuPackDetail");
			if (aHuPackDetail) {
				var aHuPack = arrHuPack.map(function (newItem) {
					var found = aHuPackDetail.find(function (oldItem) {
						return oldItem.handlingUnit.trim() === newItem.handlingUnit.trim() && oldItem.parentHU.trim() === newItem.parentHU
							.trim() &&
							oldItem.guidStock.trim() === newItem.guidStock.trim();
					});
					if (found) {
						return found;
					}
					return newItem;
				});
				this.getModel("local").setProperty("/HuPackDetail", aHuPack);
			} else {
				aHuPackDetail = this.getModel("local").setProperty("/HuPackDetail", arrHuPack);
			}
			var aOutput = this.treeify(this.getModel("local").getProperty("/HuPackDetail"), "handlingUnit", "parentHU");
			if (aOutput.length > 0) {
				// First Level
				if (aOutput[0].Children.length > 0) {
					for (var i = 0; i < aOutput[0].Children.length; i++) {
						aOutput[0].Children[i].outerMost = "Success";
						// Second Level
						for (var j = 0; j < aOutput[0].Children[i].Children.length; j++) {
							aOutput[0].Children[i].Children[j].state = "Bold";
						}
					}
				}
			}
			this.getModel("local").setProperty("/PackingOverviewList", aOutput);
			if (!this.oPackingOverviewDialog) {
				this.oPackingOverviewDialog = Utils.getFragment("", "packing.PackingOverviewDialog", this);
			}
			if (this.byId("idPackOverViewTab")) {
				this.byId("idPackOverViewTab").clearSelection();
			}
			// this.byId("idNMFCCode").setEnabled(true);
			// this.byId("idFreightClass").setEnabled(true);
			// this.byId("btnUnpackItem").setEnabled(true);
			this.oPackingOverviewDialog.open();
			this.hideBusy();
		},

		onClosePackingOverviewDialog: function () {
			this.oPackingOverviewDialog.close();
		},

		onUnpackItemPackingOverviewDialog: function () {
			var aSelectedItem = [];
			var aIndicies = this.byId("idPackOverViewTab").getSelectedIndices();
			var aRows = this.byId("idPackOverViewTab").getRows();
			for (var i = 0; i < aIndicies.length; i++) {
				if (aRows[aIndicies[i]].getBindingContext("local").getObject().handlingUnit !== this.aSelectedHUs.outbHu) {
					aSelectedItem.push(aRows[aIndicies[i]]);
				}
			}
			if (aSelectedItem.length === 0) {
				MessageBox.error(this.oBundle.getText("missingHUItemToUnpack"));
				return;
			}

			this._unpack([this.aSelectedHUs], aSelectedItem, "UnpackPartial");
			this.oPackingOverviewDialog.close();
		},
		/**** Delete HU section  ****/
		onDeleteHU: function () {
			var aSelectedHUs = this.oHUTable.getSelectedIndices();
			if (aSelectedHUs.length === 0) {
				MessageBox.error(this.oBundle.getText("SelectHUDelete"));
				return;
			}
			MessageBox.confirm(this.oBundle.getText("confirmDeleteHUMessage"), {
				title: this.oBundle.getText("ConfirmDeletion"),
				actions: [sap.m.MessageBox.Action.YES, sap.m.MessageBox.Action.NO],
				initialFocus: sap.m.MessageBox.Action.YES,
				onClose: function (oAction) {
					if (oAction === MessageBox.Action.YES) {
						this._deleteHUs(aSelectedHUs);
					}
				}.bind(this)
			});
		},

		_deleteHUs: function (aSelectedHUs) {
			var oRequestData = this._generateDeleteHUUsecase(aSelectedHUs);
			this.showBusy();
			this.getModel().create("/QuickPackQuerySet", oRequestData, {
				success: function (oData) {
					if (oData.handlingUnits) {
						this.getModel("local").setProperty("/HUs", oData.handlingUnits.results);
					} else {
						this.getModel("local").setProperty("/HUs", []);
					}
					if (oData.totes) {
						this.getModel("local").setProperty("/Contents", oData.totes.results);
					} else {
						this.getModel("local").setProperty("/Contents", []);
					}
					if (oData.return.results.length > 0) {
						var aMsg = this._generateMessages(oData.return.results);
						this._addMessage(aMsg);
						if (aMsg.length > 0) this.byId('popoverButton').firePress();
					} else {
						MessageToast.show(this.oBundle.getText("DeleteHUSuccess"));
					}
					this.hideBusy();
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

		_generateDeleteHUUsecase: function (aSelectedHUs) {
			var oTableHu = this.byId("tableHU");
			var aHUs = [];
			var aHandlingUnits = this.getModel("local").getProperty("/HUs");
			if (aSelectedHUs.length > 0) {
				aHandlingUnits.forEach(function (object) {
					aSelectedHUs.forEach(function (iIndex) {
						var selectedHU = oTableHu.getContextByIndex(iIndex).getObject();
						if (object.outbHu === selectedHU.outbHu) {
							object.sel = 'X';
						} else {
							object.sel = '';
						}
					})
					aHUs.push(object);
				});
			}
			var oData = {
				general: this.getModel("local").getProperty("/general"),
				lgNum: this.sWarehouseNumber,
				shipStation: this.sStation,
				profile: this.sProfile,
				inputType: this.sInputType,
				inputID: this.sInputIDs,
				return: [],
				totes: [],
				action: "DeletePackage",
				handlingUnits: aHUs
			};
			return oData;
		},

		/**** Complete Pack  ****/
		onCompletePack: function () {
			var oRequestData = this._generateCompletePackUsecase();
			this.showBusy();
			this.getModel().create("/QuickPackQuerySet", oRequestData, {
				success: function (oData) {
					if (oData.handlingUnits) {
						this.getModel("local").setProperty("/HUs", oData.handlingUnits.results);
					} else {
						this.getModel("local").setProperty("/HUs", []);
					}
					if (oData.totes) {
						this.getModel("local").setProperty("/Contents", oData.totes.results);
					} else {
						this.getModel("local").setProperty("/Contents", []);
					}
					if (oData.return.results.length > 0) {
						var aMsg = this._generateMessages(oData.return.results);
						this._addMessage(aMsg);
						if (aMsg.length > 0) this.byId('popoverButton').firePress();
					}
					this.hideBusy();
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

		_generateCompletePackUsecase: function (aSelectedHUs) {
			var aHus = this.getModel("local").getProperty("/HUs");
			var aContent = this.getModel("local").getProperty("/Contents");
			var oData = {
				general: this.getModel("local").getProperty("/general"),
				lgNum: this.sWarehouseNumber,
				shipStation: this.sStation,
				profile: this.sProfile,
				inputType: this.sInputType,
				inputID: this.sInputIDs,
				return: [],
				totes: (aContent) ? aContent : [],
				action: "CompletePacking",
				handlingUnits: (aHus) ? aHus : []
			};
			return oData;
		},

		// =============================== PackMaterial ===============
		onPackMaterial: function () {
			var aSelectedIndices = this.oHUTable.getSelectedIndices();
			if (aSelectedIndices.length > 1) {
				MessageBox.error(this.oBundle.getText("errorMPSSelectMsg"));
				return;
			}
			var aSelectedItems = this.oContentTable.getSelectedIndices();
			if (aSelectedItems.length === 0) {
				MessageBox.error(this.oBundle.getText("SelectItemPack"));
				return;
			}
			if (aSelectedIndices.length !== 1) {
				MessageBox.error(this.oBundle.getText("SelectHUPack"));
				return;
			}

			this._packMaterial();
		},

		_packMaterial: function () {
			this.showBusy();
			var oRequestData = this._generatePackMaterialUsecase();
			this.getModel().create("/QuickPackQuerySet", oRequestData, {
				success: function (oData) {
					if (oData.handlingUnits) {
						this.getModel("local").setProperty("/HUs", oData.handlingUnits.results);
					} else {
						this.getModel("local").setProperty("/HUs", []);
					}
					if (oData.totes) {
						this.getModel("local").setProperty("/Contents", oData.totes.results);
					} else {
						this.getModel("local").setProperty("/Contents", []);
					}
					if (oData.displaySerial) {
						this._SerialDialog();
					}
					if (oData.return.results.length > 0) {
						var aMsg = this._generateMessages(oData.return.results);
						this._addMessage(aMsg);
						if (aMsg.length > 0) this.byId('popoverButton').firePress();
					} else {
						MessageToast.show(this.oBundle.getText("PackMaterialSuccess"));
					}
					this.hideBusy();
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

		_generatePackMaterialUsecase: function (aItemUnpack) {
			var aHandlingUnits = [];
			var oTable = this.byId("tableTotes");
			var aSelectedIndices = oTable.getSelectedIndices();
			var aToteList = this.getModel("local").getProperty("/Contents");
			var aContents = [];
			var iSelectedIndex = this.oHUTable.getSelectedIndex();
			if (iSelectedIndex >= 0) {
				var oTargetHU = this.oHUTable.getContextByIndex(iSelectedIndex).getObject();
			}
			var aHUList = this.getModel("local").getProperty("/HUs");
			// handling unit table
			for (var i = 0; i < aHUList.length; i++) {
				if (aHUList[i].outbHu === oTargetHU.outbHu) {
					aHUList[i].sel = 'X';
				} else {
					aHUList[i].sel = '';
				}
				aHandlingUnits.push(aHUList[i]);
			}
			// Totes table
			aToteList.forEach(function (oTotes) {
				var bMatched = false;
				aSelectedIndices.forEach(function (iIndex) {
					var oSelected = oTable.getContextByIndex(iIndex).getObject();
					if (oTotes.guidStock === oSelected.guidStock) {
						bMatched = true;
					}
				});
				oTotes.sel = bMatched ? 'X' : '';
				aContents.push(oTotes);
			});

			var oData = {
				lgNum: this.sWarehouseNumber,
				displaySerial: false,
				shipStation: this.sStation,
				profile: this.sProfile,
				inputType: this.sInputType,
				inputID: this.sInputIDs,
				action: "Pack",
				handlingUnits: this._handleHUSPayload(aHandlingUnits),
				return: [],
				totes: aContents
			};
			return oData;
		},

		// Add New HU section
		onAddNewHU: function () {
			var oValue = this.getModel("local").getProperty("/general");
			var fieldIds = {
				Pmat: "txtPackagingMaterial",
				StorageBin: "txtStorageBin"
			};
			var hasError = false;
			for (var key in oValue) {
				if (oValue.hasOwnProperty(key) && fieldIds.hasOwnProperty(key)) {
					if (oValue[key] === "") {
						this.byId(fieldIds[key]).setValueState("Error");
						hasError = true;
					} else {
						this.byId(fieldIds[key]).setValueState("None");
					}
				}
			}
			if (!hasError) {
				this._createHU();
			}
		},

		_createHU: function () {
			this.showBusy();
			var oRequestData = this._generateCreateHUUsecase();
			this.getModel().create("/QuickPackQuerySet", oRequestData, {
				success: function (oData) {
					if (oData.handlingUnits.results.length > 0) {
						this.getModel("local").setProperty("/HUs", oData.handlingUnits.results);
					} else {
						this.getModel("local").setProperty("/HUs", []);
					}
					this.hideBusy();
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

		_generateCreateHUUsecase: function () {
			var HUSList = this._handleHUSPayload(this.getModel("local").getProperty("/HUs"));
			if (HUSList.length === 0) {
				HUSList = [{
					huPackDetails: [],
					packageLevelOption: []
				}]
			} else {
				HUSList.forEach(function () {

				})
			}
			var oData = {
				general: this.getModel("local").getProperty("/general"),
				lgNum: this.sWarehouseNumber,
				shipStation: this.sStation,
				profile: this.sProfile,
				inputType: this.sInputType,
				inputID: this.sInputIDs,
				return: [],
				totes: [],
				action: "CreatePackage",
				handlingUnits: HUSList
			};
			return oData;
		},

		//================= Un pack =============================
		onUnpack: function () {
			var aSelectedHUs = this.oHUTable.getSelectedIndices();
			if (aSelectedHUs.length > 1) {
				MessageBox.error(this.oBundle.getText("errorMPSSelectMsg"));
				return;
			}
			if (aSelectedHUs.length === 0) {
				MessageBox.error(this.oBundle.getText("SelectHUUnPack"));
				return;
			}
			if (this._numOfShippedItems(aSelectedHUs) > 0) {
				MessageBox.error(this.oBundle.getText("errorSelectedShippedItemsMsg"));
				return;
			}
			MessageBox.confirm(this.oBundle.getText("confirmUnPackHUMessage"), {
				title: this.oBundle.getText("ConfirmUnPacking"),
				actions: [sap.m.MessageBox.Action.YES, sap.m.MessageBox.Action.NO],
				initialFocus: sap.m.MessageBox.Action.YES,
				onClose: function (oAction) {
					if (oAction === MessageBox.Action.YES) {
						this._unpack(aSelectedHUs, [], "Unpack");
					}
				}.bind(this)
			});
		},

		_unpack: function (oSelectedHUs, aItemsUnpack, action) {
			this.showBusy();
			var oRequestData = this._generateUnpackUsecase(oSelectedHUs, aItemsUnpack, action);
			this.getModel().create("/QuickPackQuerySet", oRequestData, {
				success: function (oData) {
					if (oData.handlingUnits) {
						this.getModel("local").setProperty("/HUs", oData.handlingUnits.results);
					} else {
						this.getModel("local").setProperty("/HUs", []);
					}
					if (oData.totes) {
						this.getModel("local").setProperty("/Contents", oData.totes.results);
					} else {
						this.getModel("local").setProperty("/Contents", []);
					}
					if (oData.return.results.length > 0) {
						var aMsg = this._generateMessages(oData.return.results);
						this._addMessage(aMsg);
						if (aMsg.length > 0) this.byId('popoverButton').firePress();
					} else {
						MessageToast.show(this.oBundle.getText("UnpackSuccess"));
					}
					this.hideBusy();
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

		_generateUnpackUsecase: function (aSelectedHUs, aItemsUnpack, action) {
			var aHandlingUnits = [];
			var aToteList = this.getModel("local").getProperty("/Contents");
			var oTableTotes = this.byId("tableTotes");
			var aSelectedIndices = oTableTotes.getSelectedIndices();
			var aContents = [];
			var aSelectedUnpack = [];
			// Selected Handling Unit
			var aHUList = this.getModel("local").getProperty("/HUs");
			var oTableHu = this.byId("tableHU");
			if (aItemsUnpack.length > 0) {
				aHUList.forEach(function (hu) {
					aSelectedHUs.forEach(function (selectedHU) {
						// compare pack details
						selectedHU.huPackDetails.results.forEach(function (packDetail) {
							var bMatched = false;
							aItemsUnpack.forEach(function (item) {
								var oSelected = item.getBindingContext("local").getObject();
								if (packDetail.guidParent === oSelected.guidParent && packDetail.guidStock === oSelected.guidStock) {
									bMatched = true;
								}
							});
							packDetail.itemFlag = bMatched ? 'X' : '';
							if (bMatched) {
								aSelectedUnpack.push(packDetail);
							}
						});
						// tick selected
						hu.sel = (hu.outbHu === selectedHU.outbHu) ? 'X' : '';
						aHandlingUnits.push(hu);
					});
				});
			} else {
				aHUList.forEach(function (object) {
					aSelectedHUs.forEach(function (iIndex) {
						var selectedHU = oTableHu.getContextByIndex(iIndex).getObject();
						if (object.outbHu === selectedHU.outbHu) {
							object.sel = 'X';
						} else {
							object.sel = '';
						}
					})
					aHandlingUnits.push(object);
				});
			}
			//  Selected Contents
			aToteList.forEach(function (oTote) {
				var bMatched = false;
				aSelectedIndices.forEach(function (iIndex) {
					var oSelected = oTableTotes.getContextByIndex(iIndex).getObject();
					if (oTote.guidStock === oSelected.guidStock) {
						bMatched = true;
					}
				});
				oTote.sel = bMatched ? 'X' : '';
				oTote.partialQty = oTote.partialQty + "";
				aContents.push(oTote);
			});
			//  Selected Unpack

			var oData = {
				lgNum: this.sWarehouseNumber,
				shipStation: this.sStation,
				profile: this.sProfile,
				inputType: this.sInputType,
				inputID: this.sInputIDs,
				action: action,
				handlingUnits: this._handleHUSPayload(aHandlingUnits),
				return: [],
				totes: aContents,
				huPack: (aSelectedUnpack) ? aSelectedUnpack : []
			};
			return oData;
		},

		_numOfShippedItems: function (aSelectedIndices) {
			var iNumOfShippedItems = 0;
			for (var i = 0; i < aSelectedIndices.length; i++) {
				var oContext = this.oHUTable.getContextByIndex(aSelectedIndices[i]);
				var oItemData = oContext.getObject();
				if (oItemData.trackingNumber && oItemData.trackingNumber !== "") {
					iNumOfShippedItems++;
				}
			}
			return iNumOfShippedItems;
		},

		// Pack and Unpack section
		onPackPartial: function () {
			var aSelectedIndices = this.oHUTable.getSelectedIndices();
			var aSelectedContexts = aSelectedIndices.map(function (iIndex) {
				return this.oHUTable.getContextByIndex(iIndex);
			}, this);
			if (aSelectedContexts.length > 1) {
				MessageBox.error(this.oBundle.getText("errorMPSSelectMsg"));
				return;
			}
			var aSelectedItems = this.oContentTable.getSelectedIndices();
			if (aSelectedItems.length !== 1) {
				MessageBox.error(this.oBundle.getText("SelectItemPackPartial"));
				return;
			}
			if (aSelectedContexts.length !== 1) {
				MessageBox.error(this.oBundle.getText("SelectHUPack"));
				return;
			}
			this._packPartial();
		},

		_packPartial: function () {
			var oRequestData = this._generatePackPartialUsecase();
			this.showBusy();
			this.getModel().create("/QuickPackQuerySet", oRequestData, {
				success: function (oData) {
					if (oData.handlingUnits) {
						this.getModel("local").setProperty("/HUs", oData.handlingUnits.results);
					} else {
						this.getModel("local").setProperty("/HUs", []);
					}
					if (oData.totes) {
						this.getModel("local").setProperty("/Contents", oData.totes.results);
					} else {
						this.getModel("local").setProperty("/Contents", []);
					}
					if (oData.displaySerial) {
						this._SerialDialog();
					}
					if (oData.return.results.length > 0) {
						var aMsg = this._generateMessages(oData.return.results);
						this._addMessage(aMsg);
						if (aMsg.length > 0) this.byId('popoverButton').firePress();
					} else {
						MessageToast.show(this.oBundle.getText("PackPartialSuccess"));
					}
					this.hideBusy();
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

		_generatePackPartialUsecase: function () {
			var aHandlingUnits = [];
			var oTable = this.byId("tableTotes");
			var aSelectedIndices = oTable.getSelectedIndices();
			var aToteList = this.getModel("local").getProperty("/Contents");
			var aContents = [];
			var iSelectedIndex = this.oHUTable.getSelectedIndex();
			if (iSelectedIndex >= 0) {
				var oTargetHU = this.oHUTable.getContextByIndex(iSelectedIndex).getObject();
			}
			var aHUList = this.getModel("local").getProperty("/HUs");
			// handling unit table
			for (var i = 0; i < aHUList.length; i++) {
				if (aHUList[i].outbHu === oTargetHU.outbHu) {
					aHUList[i].sel = 'X';
				} else {
					aHUList[i].sel = '';
				}
				aHandlingUnits.push(aHUList[i]);
			}
			// Totes table
			aToteList.forEach(function (oTotes) {
				var bMatched = false;
				aSelectedIndices.forEach(function (iIndex) {
					var oSelected = oTable.getContextByIndex(iIndex).getObject();
					if (oTotes.guidStock === oSelected.guidStock) {
						bMatched = true;
					}
				});
				oTotes.sel = bMatched ? 'X' : '';
				aContents.push(oTotes);
			});
			var oData = {
				lgNum: this.sWarehouseNumber,
				displaySerial: false,
				shipStation: this.sStation,
				profile: this.sProfile,
				inputType: this.sInputType,
				inputID: this.sInputIDs,
				action: "PackPartial",
				general: this.getModel("local").getProperty("/general"),
				handlingUnits: this._handleHUSPayload(aHandlingUnits),
				return: [],
				totes: aContents
			};
			return oData;
		},

		_handleHUSPayload: function (aHUS) {
			var aHandlingUnit = [];
			if (aHUS && aHUS.length > 0) {
				aHUS.forEach(function (item) {
					var oHUs = {
						outbHu: item.outbHu,
						pMat: item.pMat,
						lgpLaPa: item.lgpLaPa,
						length: item.length,
						width: item.width,
						height: item.height,
						unit: item.unit,
						weight: item.weight,
						weightUnit: item.weightUnit,
						sel: item.sel,
						trackingNumber: item.trackingNumber,
						docNo: item.docNo,
						docCat: item.docCat,
						overPack: item.overPack,
						huPackDetails: item.huPackDetails
					};
					aHandlingUnit.push(oHUs);
				})
			}
			if (aHandlingUnit.length > 0) {
				var check = {};
				var res = [];
				for (var j = 0; j < aHandlingUnit.length; j++) {
					if (!check[aHandlingUnit[j]['outbHu']]) {
						check[aHandlingUnit[j]['outbHu']] = true;
						res.push(aHandlingUnit[j]);
					}
				}
				aHandlingUnit = res;
			}
			return aHandlingUnit;
		},

		_updateShippingStatus: function (aSelectedContexts) {
			var oModel = this.getModel("local"),
				aHandlingUnits = oModel.getProperty("/HUS") || [],
				aTotes = oModel.getProperty("/Contents") || [];
			//this check shipped
			var bShipped = !this.bError && (
				aTotes.length > 0 ||
				aHandlingUnits.length === 0 ||
				aHandlingUnits.some(function (item) {
					return item.trackingNumber === "";
				})
			);
				oModel.setProperty("/Shipped", bShipped);
			// This check if any HU has Trackingnumber
			var aSelectedKeys = aSelectedContexts.map(function (oItem) {
				return oItem.getBindingContext("local").getObject().Outbhu;
			});

			var bHasTracking = aHandlingUnits.some(function (item) {
				return item.trackingNumber && item.trackingNumber !== "";
			});
			oModel.setProperty("/HasTracking", bHasTracking);

			// This Check selected 
			var bSelectedHasTracking = aHandlingUnits.some(function (item) {
				return aSelectedKeys.includes(item.Outbhu) && item.trackingNumber && item.trackingNumber !== "";
			});
			if (!bSelectedHasTracking && aSelectedContexts.length > 0) {
				this.getModel("local").setProperty("/isOnlyOneSelected", true);
			} else {
				this.getModel("local").setProperty("/isOnlyOneSelected", false);
			}
		},
	});
});