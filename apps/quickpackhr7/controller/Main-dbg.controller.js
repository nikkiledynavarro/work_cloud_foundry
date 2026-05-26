sap.ui.define([
	"com/erpis/shiperp/quickpack/hr7/controller/BaseController",
	"sap/ui/model/json/JSONModel",
	"com/erpis/shiperp/quickpack/hr7/model/formatter",
	"sap/m/MessageBox",
	"com/erpis/shiperp/quickpack/hr7/common/Utils",
	"sap/ui/model/Filter",
	"sap/ui/model/FilterOperator",
	"sap/m/Token",
	"sap/m/MessageToast",
	"com/erpis/shiperp/quickpack/hr7/common/hotkeyInterface"
], function (BaseController, JSONModel, formatter, MessageBox, Utils, Filter, FilterOperator, Token, MessageToast, HotkeyInterface) {
	"use strict";

	return BaseController.extend("com.erpis.shiperp.quickpack.hr7.controller.Home", {

		formatter: formatter,

		oBundle: null,

		sDocumentID: "",

		oHUTab: null,

		oContentTab: null,

		sQuantitySelection: null,

		bAutoPack: null,
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

			// Initialize Message Model
			var oJSONModel = new JSONModel({
				aMessages: [],
				Contents: [],
				HUs: [],
				messagesLength: 0
			});
			this.setModel(new JSONModel(), "local");
			this.setModel(new JSONModel(), "settings");
			this.setModel(oJSONModel, "messageModel");
			this.oHUTab = this.byId("tableHU");
			this.oContentTab = this.byId("tableItem");

			this.getRouter().getRoute("main").attachPatternMatched(this._onObjectMatched, this);
			this.getView().byId("txtId").addValidator(function (args) {
				var text = args.text;
				return new Token({
					key: text,
					text: text
				});
			});

			HotkeyInterface.getInstance(this.getOwnerComponent()).bindHotKeys(this.getHotKeysHandlers());
		},

		/**
		 * Binds the view to the object path.
		 * @function
		 * @param {sap.ui.base.Event} oEvent pattern match event in route 'object'
		 * @private
		 */
		_onObjectMatched: function (oEvent) {
			this.oDefaultProfileSettingDeferred = $.Deferred();
			this.showBusy();
			this.sStation = oEvent.getParameter("arguments").Station;
			this.sProfile = oEvent.getParameter("arguments").Profile;
			this.sInputType = oEvent.getParameter("arguments").InputType;

			this.getModel().metadataLoaded().then(this.getProfileConfig.bind(this));
		},
		onDocumentSubmit: function (oEvent) {
			var oControl = oEvent.getSource();
			this.sDocumentID = oControl.getValue();
			oControl.setValueState("None");
			if (!this.sDocumentID) {
				//MessageBox.error(this.oBundle.getText("checkDocumentID"));
				oControl.setValueState("Error");
				return;
			}

			this._scanDocument(this.sDocumentID);

		},

		onItemSubmit: function (oEvent) {
			var oQtyInput = this.byId("txtQty");
			var oControl = oEvent.getSource();
			var sItem = oControl.getValue().trim();
			oControl.setValueState("None");
			var oValid = this._isValidItem(sItem);
			if (!oValid.isValidItem) {
				MessageBox.error(oValid.Message);
				oControl.setValueState("Error");
				return;
			}
			if (oQtyInput.getEditable()) {
				oQtyInput.focus();
				oQtyInput.setValue(parseInt(oValid.oItem, 10));
				return;
			}
			// var oControl = oEvent.getSource();
			this._itemSubmit(sItem);
		},

		onCreateShipment: function (oEvent) {
			var aHUitems = this.getModel("local").getProperty("/HUs");
			if (aHUitems.length == 0) {
				return;
			}
			this._checkValidateShipment();
		},

		_checkValidateShipment: function () {
			this.showBusy();
			var aHUitems = this.getModel("local").getProperty("/HUs");
			for (var i = 0; aHUitems.length > i; i++) {
				var value = (parseFloat(aHUitems[i].Height) + parseFloat(aHUitems[i].Width)) * 2 + parseFloat(aHUitems[i].Length);
				if (value > 130 && value < 165 && this.byId("cbCarrier").getSelectedKey() == "UPS") {
					MessageBox.confirm(this.oBundle.getText("SurchargeConfirm"), {
						title: "Surcharge", // default
						actions: MessageBox.Action.OK,
						onClose: function () {
							this._scanCreateShipment(this.sDocumentID);
						}.bind(this)
					});
					return;
				} else {
					this._scanCreateShipment(this.sDocumentID);
					return;
				}
			}
		},

		onItemChange: function () {
			if (this.getModel("settings").getProperty("/DefaultProfileSetting/QuantitySelection") !== "2") {
				var oQtyInput = this.byId("txtQty");
				oQtyInput.setValue("");
			}
		},

		onQtySubmit: function (oEvent) {
			// var oQtyInput = this.byId("txtQty");
			var oControl = oEvent.getSource();
			var sQuantity = oControl.getValue();
			//var sItem = oControl.getValue().trim();
			oControl.setValueState("None");
			// var oValid = this._isValidItem(sItem);
			// if (sQuantity > parseInt(oValid.oItem, 10)) {
			// 	MessageBox.error(this.oBundle.getText("quantity", [sItem, oValid.oItem]));
			// 	oControl.setValueState("Error");
			// 	return;
			// }
			oControl.setValueState("None");
			if (!sQuantity) {
				MessageBox.error(this.oBundle.getText("quantityEmpty"));
				oControl.setValueState("Error");
				return;
			}
			if (sQuantity <= 0 || parseInt(sQuantity, 10) != sQuantity) {
				MessageBox.error(this.oBundle.getText("invalidQuantity"));
				oControl.setValueState("Error");
				return;
			}
			this._itemSubmit(this.byId("txtItem").getValue().trim());
		},

		_itemSubmit: function (sItem) {
			// var oControl = oEvent.getSource();
			// var sItem = oControl.getValue().trim();
			// oControl.setValueState("None");
			// var oValid = this._isValidItem(sItem);
			// if (!oValid.isValidItem) {
			// 	MessageBox.error(oValid.Message);
			// 	oControl.setValueState("Error");
			// 	return;
			// }

			var oValid = this._isValidItem(sItem);

			var aItems = this._getItemFromList(sItem);
			if (aItems.length === 0) {
				MessageBox.error(this.oBundle.getText("scanItemerror", [sItem]), {
					onClose: function () {
						this.byId("txtItem").focus();
						this.byId("txtItem").setValue("");
						if (this.sQuantitySelection !== "2") {
							this.byId("txtQty").setValue("");
						}
					}.bind(this)
				});

			} else if (aItems.length === 1) {
				if (this.bAutoPack) {
					if (this.sQuantitySelection === "3") {
						MessageBox.warning(this.oBundle.getText("AutoPackUserInput"));
						return;
					}
					this.setSelectedItem(aItems[0], true);
					this._scanItem(aItems[0], false);
					if (this.sQuantitySelection !== "2") {
						this.byId("txtQty").setValue(parseInt(aItems[0].Balance, 10));
					}
				} else {
					// set selected item.
					// this.oContentTab.removeSelections(true);
					// this.oContentTab.setSelectedItem(aItems[0], true);
					this.setSelectedItem(aItems[0]);
					if (this.sQuantitySelection === "1") {
						this.byId("txtQty").setValue(parseInt(aItems[0].Balance, 10));
					}
					if (parseInt(this.byId("txtQty").getValue(), 10) > parseInt(oValid.oItem, 10)) {
						MessageBox.error(this.oBundle.getText("quantity", [parseInt(this.byId("txtQty").getValue(), 10), oValid.oItem]));
						return;
					}
				}
			} else {
				if (this.sQuantitySelection === "3" && this.bAutoPack) {
					MessageBox.warning(this.oBundle.getText("AutoPackUserInput"));
					this._oRefDialog.close();
				}
				this._oRefDialog = Utils.getFragment("", "DuplicateItemsSelection", this);
				this._oRefDialog._searchField.setPlaceholder("Search - Please enter item number");
				this._oRefDialog.setModel(new JSONModel({
					Items: aItems
				}));
				
				this._oRefDialog.open();

			}
		},

		setSelectedItem: function (oData) {
			this.oContentTab.removeSelections(true);
			var aItems = this.oContentTab.getItems();
			for (var i = 0; i < aItems.length; i++) {
				if (aItems[i].getBindingContext("local").getObject() === oData) {
					aItems[i].setSelected(true);
					return;
				}
			}
		},

		onPackMaterialPress: function () {
			var sQuantity = this.byId("txtQty").getValue();
			this.byId("txtQty").setValueState("None");
			var sValueQty = this.getModel("settings").getProperty("/DefaultProfileSetting/QuantitySelection");
			if (sValueQty === "3") {
				if (!sQuantity) {
					MessageBox.error(this.oBundle.getText("quantityEmpty"));
					this.byId("txtQty").setValueState("Error");
					return;
				}
				if (sQuantity <= 0 || parseInt(sQuantity, 10) != sQuantity) {
					MessageBox.error(this.oBundle.getText("invalidQuantity"));
					this.byId("txtQty").setValueState("Error");
					return;
				}
			}
			var sItem = this.byId("tableItem").getSelectedItem();
			var oItem = sItem.getBindingContext("local").getObject();
			var sValueItem = oItem.Material;
			var aSelectedItems = this.oContentTab.getSelectedItems();
			if (aSelectedItems.length !== 1) {
				MessageBox.error(this.oBundle.getText("SelectItemPack"));
				return;
			}
			var oData = aSelectedItems[0].getBindingContext("local").getObject();

			if (parseInt(oData.Balance, 10) > 0) {
				this._scanItem(oData, false);
				this.byId("txtItem").setValue(formatter.removeLeadingZero(oData.Material));
				if (sValueQty === "1") {
					this.byId("txtQty").setValue(parseInt(oData.Balance, 10));
				}
			} else {
				MessageBox.error(this.oBundle.getText("scanItemerror", [sValueItem]), {
					onClose: function () {
						this.byId("txtItem").focus();
						this.byId("txtItem").setValue("");
						if (this.sQuantitySelection !== "2") {
							this.byId("txtQty").setValue("");
						}
					}.bind(this)
				});
			}
		},

		onPackPartial: function () {
			var sQuantity = this.byId("txtQty").getValue();
			this.byId("txtQty").setValueState("None");
			var sValueQty = this.getModel("settings").getProperty("/DefaultProfileSetting/QuantitySelection");
			if (sValueQty === "3") {
				if (!sQuantity) {
					MessageBox.error(this.oBundle.getText("quantityEmpty"));
					this.byId("txtQty").setValueState("Error");
					return;
				}
				if (sQuantity <= 0 || parseInt(sQuantity, 10) != sQuantity) {
					MessageBox.error(this.oBundle.getText("invalidQuantity"));
					this.byId("txtQty").setValueState("Error");
					return;
				}
			}
			var aSelectedItems = this.oContentTab.getSelectedItems();
			var sItem = this.byId("tableItem").getSelectedItem();
			if (!sItem || aSelectedItems.length !== 1) {
				MessageBox.error(this.oBundle.getText("SelectItemPack"));
				return;
			} else {
				var oItem = sItem.getBindingContext("local").getObject();
				var sValueItem = oItem.Material;
			}
			// if (aSelectedItems.length !== 1) {
			// 	MessageBox.error(this.oBundle.getText("SelectItemPack"));
			// 	return;
			// }
			var oData = aSelectedItems[0].getBindingContext("local").getObject();

			if (parseInt(oData.Balance, 10) > 0) {
				this._scanItem(oData, true);
				this.byId("txtItem").setValue(formatter.removeLeadingZero(oData.Material));
				if (sValueQty === "1") {
					this.byId("txtQty").setValue(parseInt(oData.Balance, 10));
				}
			} else {
				MessageBox.error(this.oBundle.getText("scanItemerror", [sValueItem]), {
					onClose: function () {
						this.byId("txtItem").focus();
						this.byId("txtItem").setValue("");
						if (this.sQuantitySelection !== "2") {
							this.byId("txtQty").setValue("");
						}
					}.bind(this)
				});
			}
		},

		onAddNewHU: function (oEvent) {
			this._addNewHU();
		},
		onResetData: function () {
			this.showBusy();
			setTimeout(this._resetData.bind(this), 1000);
		},

		onSearchHUUnit: function (oEvent) {
			var aFilter = [];
			var sQuery = oEvent.getParameter("newValue");
			if (sQuery && sQuery.length > 0) {
				aFilter.push(new Filter("HandlingUnit", sap.ui.model.FilterOperator.Contains, sQuery));
			}
			var oBingding = this.oHUTab.getBinding("items");
			oBingding.filter(aFilter);
		},

		handleItemSelectionSearch: function (oEvent) {
			var sValue = oEvent.getParameter("value");
			var oFilterItem = new Filter("Item", sap.ui.model.FilterOperator.Contains, sValue);
			var oBinding = oEvent.getSource().getBinding("items");
			oBinding.filter([oFilterItem]);
		},

		onItemsSelectionConfirm: function (oEvent) {
			var oData = oEvent.getParameter("selectedContexts")[0].getObject();
			if (this.getModel("settings").getProperty("/DefaultProfileSetting/AutoPack") === true) {
				this.setSelectedItem(oData);
				this._scanItem(oData, false);
				if (this.getModel("settings").getProperty("/DefaultProfileSetting/QuantitySelection") !== "2") {
					this.byId("txtQty").setValue(parseInt(oData.Balance, 10));
				}
				if (parseInt(this.byId("txtQty").getValue(), 10) > parseInt(oData.Balance, 10)) {
					MessageBox.error(this.oBundle.getText("quantity", [parseInt(this.byId("txtQty").getValue(), 10), oData.Balance]));
					return;
				}
			} else {
				// set selected item.		
				this.setSelectedItem(oData);
				if (this.getModel("settings").getProperty("/DefaultProfileSetting/QuantitySelection") === "1") {
					this.byId("txtQty").setValue(parseInt(oData.Balance, 10));
				}
				if (parseInt(this.byId("txtQty").getValue(), 10) > parseInt(oData.Balance, 10)) {
					MessageBox.error(this.oBundle.getText("quantity", [parseInt(this.byId("txtQty").getValue(), 10), oData.Balance]));
					return;
				}
			}
		},

		onOpenHUItemsDialog: function (oEvent) {
			var aItems = oEvent.getSource().getBindingContext("local").getProperty("FreightUnitItemSet").results;
			// if (!oControl){
			// 	return;
			// }
			// var aItems = oControl.results;
			this._oHUItemsDialog = Utils.getFragment("", "HUItemsDialog", this);
			this._oHUItemsDialog.setModel(new JSONModel({
				HUItem: aItems
			}));
			this._oHUItemsDialog.open();

		},

		onCloseHUItemsDialog: function () {
			this._oHUItemsDialog.close();
		},
		/* =========================================================== */
		/* event handlers                                              */
		/* =========================================================== */
		_scanDocument: function (sDocumentID) {
			this.showBusy();
			var oRequestData = this._generateDocumentlUsecase(sDocumentID);
			var sValueQty = this.getModel("settings").getProperty("/DefaultProfileSetting/QuantitySelection");
			this.getModel().create("/InputQuerySet", oRequestData, {
				success: function (oData) {
					if (oData) {
						if (oData.Contents) {
							this.getModel("local").setProperty("/Contents", oData.Contents.results || []);
						} else {
							this.getModel("local").setProperty("/Contents", []);
						}
						if (oData.FreightUnits) {
							this.getModel("local").setProperty("/HUs", oData.FreightUnits.results);
						} else {
							this.getModel("local").setProperty("/HUs", []);
						}
						if (oData.Basic) {
							this.getModel("local").setProperty("/Basic", oData.Basic);
						} else {
							this.getModel("local").setProperty("/Basic", {});
						}
						if (oData.CarrierListSet) {
							this.getModel("local").setProperty("/CarrierListSet", oData.CarrierListSet.results);
						} else {
							this.getModel("local").setProperty("/CarrierListSet", []);
						}
						if (oData.ServiceListSet) {
							this.getModel("local").setProperty("/ServiceListSet", oData.ServiceListSet.results);
						} else {
							this.getModel("local").setProperty("/ServiceListSet", []);
						}
						if (oData.CarrierProfile) {
							this.getModel("local").setProperty("/CarrierProfile", oData.CarrierProfile);
						} else {
							this.getModel("local").setProperty("/CarrierProfile", {});
						}
						this.getModel("local").setProperty("/Address", oData.Address || {});
					}
					this.byId("txtId").setEditable(false); //Disable DocumentId input
					this.byId("txtItem").setEnabled(true);
					this.byId("txtQty").setEnabled(true);
					if (sValueQty === "3") {
						this.byId("txtQty").setEditable(true);
					} else if (sValueQty === "2") {
						this.byId("txtQty").setValue(parseInt("1", 10));
					}
					jQuery.sap.delayedCall(200, this, function () {
						this.byId("txtItem").focus();
					});
					this._selectLastHU();
					this.mappingAddress();
					this.mappingService();
					this.hideBusy();
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

		_scanCreateShipment: function (sDocumentID) {
			this.showBusy();
			var oRequestData = this._generateCreateShipment(sDocumentID);
			this.getModel().create("/InputQuerySet", oRequestData, {
				success: function (oData) {
					if (oData) {
						if (oData.FreightUnits) {
							this.getModel("local").setProperty("/HUs", oData.FreightUnits.results);
						} else {
							this.getModel("local").setProperty("/HUs", []);
						}
						if (oData.ShipmentLabelSet) {
							this.getModel("local").setProperty("/ShipmentLabelSet", oData.ShipmentLabelSet);
						} else {
							this.getModel("local").setProperty("/ShipmentLabelSet", []);
						}
						if (oData.Basic) {
							this.getModel("local").setProperty("/Basic", oData.Basic);
						} else {
							this.getModel("local").setProperty("/Basic", {});
						}
						if (oData.CarrierProfile) {
							this.getModel("local").setProperty("/CarrierProfile", oData.CarrierProfile);
						} else {
							this.getModel("local").setProperty("/CarrierProfile", {});
						}
						if (oData.ShipmentLabelSet === null) {
							MessageBox.error(this.oBundle.getText("NoPrintPreviewAvailable"));
						} else if (oData.ShipmentLabelSet.length === 0) {
							MessageBox.error(this.oBundle.getText("NoPrintPreview"));
						} else {
							MessageToast.show(this.oBundle.getText("ReprintSuccess"));
							var sPath;
							for (var i = 0; i < oData.ShipmentLabelSet.results.length; i++) {
								sPath = this.getModel().sServiceUrl + "/ShipmentLabelSet(shipmentid='',Documentid='',Guid='" + oData.ShipmentLabelSet.results[
										i].Guid +
									"')/$value";
								sap.m.URLHelper.redirect(sPath, true);
							}
						}
					}
					this.mappingAddress();
					this.mappingService();
					this.hideBusy();
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

		mappingAddress: function () {

			// Filter the Shipto Region Dropdown based on Country
			var oShipFromStateSel = this.byId("slShipFromState");
			oShipFromStateSel.getBinding("items").filter(new Filter("Country", "EQ", this.getModel("local").getProperty(
				"/Address/SHIPFROM/land1")));
			// Filter the Shipto Region Dropdown based on Country
			var oShipToStateSel = this.byId("slShipToState");
			oShipToStateSel.getBinding("items").filter(new Filter("Country", "EQ", this.getModel("local").getProperty("/Address/SHIPTO/land1"))); // Filter the Shipto Region Dropdown based on Country
			var oSoldToStateSel = this.byId("slSoldToState");
			oSoldToStateSel.getBinding("items").filter(new Filter("Country", "EQ", this.getModel("local").getProperty("/Address/SOLDTO/land1")));
			var oImporterStateSel = this.byId("slImporterState");
			oImporterStateSel.getBinding("items").filter(new Filter("Country", "EQ", this.getModel("local").getProperty(
				"/Address/IMPORTER/land1")));

		},

		mappingService: function () {
			var oService = this.byId("selectService");
			var oItemTemplate = new sap.ui.core.Item({
				key: "{local>Service}",
				text: "{local>Description}"
			});
			var sValue = this.getModel("local").getProperty("/Basic/Carrier");
			var oItemBindindInfo = {
				path: "local>/ServiceListSet",
				filters: [new Filter({
					path: "Scac",
					operator: FilterOperator.EQ,
					value1: sValue
				})],
				template: oItemTemplate
			};
			oService.bindItems(oItemBindindInfo);
			// oService.getBinding("items").filter(new Filter("Scac","EQ", this.getModel("local").getProperty("/Basic/Carrier")));
		},

		_generateDocumentlUsecase: function (sDocumentID) {
			var sAction = "ScanDelivery";
			var sScenario = this.getModel("settings").getProperty("/DefaultProfileSetting/Scenario");
			if (sScenario === "2") {
				sAction = "ScanShipment";
			}
			var oData = {
				Action: sAction,
				DocumentID: sDocumentID,
				Basic: {
					Profile: this.sProfile,
					Shipstation: this.sStation,
					Carrier: "",
					Service: "",
					Settings: this.getModel("settings").getProperty("/DefaultProfileSetting")
				},
				Address: {},
				Contents: [],
				FreightUnits: [{
					FreightUnitItemSet: []
				}],
				CarrierListSet: [],
				ServiceListSet: [],
				CarrierProfile: {}
			};
			return oData;
		},

		_generateCreateShipment: function (sDocumentID) {
			var sAction = "CreateShipment";
			var sCarrier = this.byId("cbCarrier").getSelectedKey();
			var sService = this.byId("selectService").getSelectedKey();
			var aFreighUnits = this.getModel("local").getProperty("/HUs");
			var aSelectedItems = this.oHUTab.getSelectedItems();
			if (aFreighUnits.length === 0) {
				aFreighUnits = [{
					FreightUnitItemSet: []
				}];
			} else {
				for (var i = 0; i < aFreighUnits.length; i++) {
					if (!aFreighUnits[i].FreightUnitItemSet) {
						aFreighUnits[i].FreightUnitItemSet = [];
					}
				}
			}

			if (aSelectedItems.length > 0) {
				var oSelectedHU = aSelectedItems[0].getBindingContext("local").getObject();
				for (var i = 0; i < aFreighUnits.length; i++) {
					if (aFreighUnits[i].HandlingUnit === oSelectedHU.HandlingUnit) {
						aFreighUnits[i].SelectedFlag = true;
					}
				}
			}

			var oData = {
				Action: sAction,
				DocumentID: sDocumentID,
				Basic: {
					Profile: this.sProfile,
					Shipstation: this.sStation,
					Carrier: sCarrier,
					Service: sService,
					Settings: this.getModel("settings").getProperty("/DefaultProfileSetting")
				},
				Address: {},
				Contents: [],
				FreightUnits: aFreighUnits,
				CarrierListSet: [],
				ServiceListSet: [],
				CarrierProfile: {},
				ShipmentLabelSet: []
			};
			return oData;
		},

		_isValidItem: function (sItem) {
			var sItemSelection = this.getModel("settings").getProperty("/DefaultProfileSetting/ItemSelection");
			var aContents = this.getModel("local").getProperty("/Contents");
			var sProperty = "Material";
			if (!sItem) {
				return {
					isValidItem: false,
					Message: this.oBundle.getText("EmptyItemField")
				};
			}
			if (sItemSelection === "2") { //1=material
				sProperty = "Ean11";
			}
			//
			for (var i = 0; i < aContents.length; i++) {
				if (sProperty === "Material") {
					if (this.formatter.removeLeadingZero(sItem.toUpperCase()) === this.formatter.removeLeadingZero(aContents[i].Material.toUpperCase())) {
						return {
							isValidItem: true,
							oItem: aContents[i].Balance
						};
					}
				} else if (sProperty === "Ean11") {
					if (sItem === aContents[i].Ean11) {
						return {
							isValidItem: true,
							oItem: aContents[i].Balance
						};
					}
				}
			}
			var oMessagekey = {
				Material: "MaterialNotValid",
				Ean11: "UPCNotValid"
			};
			return {
				isValidItem: false,
				Message: this.oBundle.getText(oMessagekey[sProperty], [sItem])
			};

		},

		_getItemFromList: function (sItem) {
			var aContents = this.getModel("local").getProperty("/Contents");
			if (aContents.length === 1) {
				return aContents;
			}
			//
			var aItems = [];
			for (var i = 0; i < aContents.length; i++) {
				if ((this.formatter.removeLeadingZero(sItem.toUpperCase()) === this.formatter.removeLeadingZero(aContents[i].Material.toUpperCase()) ||
						sItem === aContents[i].Ean11) && parseInt(aContents[i].Balance, 10) > 0) {
					aItems.push(aContents[i]);
				}
			}
			return aItems;
		},

		_scanItem: function (oItem, bIsPartialScan) {
			this.showBusy();
			var oRequestData = this._generateItemlUsecase(oItem, bIsPartialScan);
			this.getModel().create("/InputQuerySet", oRequestData, {
				success: function (oData) {
					var oContent = this.getModel("local").getProperty("/Contents");
					if (oData) {
						if (oData.FreightUnits) {
							this.getModel("local").setProperty("/HUs", oData.FreightUnits.results);
						} else {
							this.getModel("local").setProperty("/HUs", []);
						}
						if (oData.Contents) {
							this.getModel("local").setProperty("/Contents", oData.Contents.results);
						} else {
							this.getModel("local").setProperty("/Contents", []);
						}
					}
					this._selectLastHU();
					if (oContent && oContent.length === 1) {
						if (this.sQuantitySelection !== "2") {
							this.byId("txtQty").setValue("");
						}
					} else {
						if (this.sQuantitySelection !== "2") {
							this.byId("txtQty").setValue("");
						}
						this.byId("txtItem").setValue("");
					}
					this.hideBusy();
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					if (this.sQuantitySelection !== "2") {
						this.byId("txtQty").setValue("");
					}
					this.byId("txtItem").setValue("");
					this.hideBusy();
				}.bind(this)
			});
		},

		_selectLastHU: function () {
			var bSelectLastHU = this.getModel("settings").getProperty("/DefaultProfileSetting/SelectLastHU");
			var aItems = this.oHUTab.getItems();
			if (aItems.length === 0) {
				return;
			}
			if (bSelectLastHU) {
				this.oHUTab.removeSelections(true);
				this.oHUTab.setSelectedItem(aItems[aItems.length - 1], true);
			}
			setTimeout(function () {
				this.byId("txtItem").focus();
			}.bind(this), 0);
		},

		_deselectFirstHU: function () {
			var aFreighUnits = this.getModel("local").getProperty("/HUs");
			var aSelectedItems = this.oHUTab.getSelectedItems();
			if (aSelectedItems.length > 0) {
				var oSelectedHU = aSelectedItems[0].getBindingContext("local").getObject();
				for (var i = 0; i < aFreighUnits.length; i++) {
					if (aFreighUnits[i].HandlingUnit === oSelectedHU.HandlingUnit) {
						this.oHUTab.removeSelections(true);
						aFreighUnits[i].SelectedFlag = false;
						break;
					}
				}
			} else {
				for (i = 0; i < aFreighUnits.length; i++) {
					this.oHUTab.removeSelections(true);
					aFreighUnits[i].SelectedFlag = false;
					break;
				}
			}
		},

		_generateItemlUsecase: function (oItem, bIsPartialScan) {
			var sItemSelection = this.getModel("settings").getProperty("/DefaultProfileSetting/ItemSelection");
			var sQuantity = "1";
			var sAction = "ScanMaterial";
			if (sItemSelection === "2") {
				sAction = "ScanUpcEan";
			}
			if (!this.bAutoPack) {
				if (bIsPartialScan) {
					sAction = "ParcelPack";
				} else {
					sAction = "ManualPack";
				}
			}
			if (this.sQuantitySelection === "3") {
				sQuantity = this.byId("txtQty").getValue();
			} else if (this.sQuantitySelection === "1") {
				sQuantity = oItem.Balance;
			}

			var aFreighUnits = this.getModel("local").getProperty("/HUs");
			if (aFreighUnits.length === 0) {
				aFreighUnits = [{
					FreightUnitItemSet: []
				}];
			} else {
				for (var i = 0; i < aFreighUnits.length; i++) {
					if (!aFreighUnits[i].FreightUnitItemSet) {
						aFreighUnits[i].FreightUnitItemSet = [];
					}
				}
			}

			var aSelectedItems = this.oHUTab.getSelectedItems();
			if (aSelectedItems.length > 0) {
				var oSelectedHU = aSelectedItems[0].getBindingContext("local").getObject();
				for (var i = 0; i < aFreighUnits.length; i++) {
					if (aFreighUnits[i].HandlingUnit === oSelectedHU.HandlingUnit) {
						aFreighUnits[i].SelectedFlag = true;
						break;
					}
				}
			}

			var oData = {
				Action: sAction,
				DocumentID: this.sDocumentID,
				Packmaterial: this.byId("cbInputType").getSelectedKey(),
				Quantity: sQuantity,
				LineItem: oItem.Item,
				Material: oItem.Material,
				Basic: {
					Profile: this.sProfile,
					Shipstation: this.sStation,
					Carrier: "",
					Service: "",
					Settings: this.getModel("settings").getProperty("/DefaultProfileSetting")
				},
				Contents: this.getModel("local").getProperty("/Contents"),
				FreightUnits: aFreighUnits,
				CarrierProfile: this.getModel("local").getProperty("/CarrierProfile")
			};
			return oData;
		},

		_addNewHU: function () {
			this.showBusy();
			var oRequestData = this._generateNewHUUsecase();
			var bNewHUOnPack = this.getModel("settings").getProperty("/DefaultProfileSetting/NewHUOnPack");
			this.getModel().create("/InputQuerySet", oRequestData, {
				success: function (oData) {
					if (oData) {
						if (oData.FreightUnits) {
							this.getModel("local").setProperty("/HUs", oData.FreightUnits.results);
						} else {
							this.getModel("local").setProperty("/HUs", []);
						}
					}
					this._deselectFirstHU();
					if (bNewHUOnPack === true) {
						this._selectLastHU();
					}
					this.hideBusy();
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

		_generateNewHUUsecase: function () {
			var sPackingMaterial = this.byId("cbInputType").getSelectedKey();
			var aFreighUnits = this.getModel("local").getProperty("/HUs");
			if (aFreighUnits.length === 0) {
				aFreighUnits = [{
					FreightUnitItemSet: []
				}];
			} else {
				for (var i = 0; i < aFreighUnits.length; i++) {
					if (!aFreighUnits[i].FreightUnitItemSet) {
						aFreighUnits[i].FreightUnitItemSet = [];
					}
				}
			}
			var oData = {
				Action: "NewHU",
				DocumentID: this.sDocumentID,
				Basic: {
					Profile: this.sProfile,
					Shipstation: this.sStation,
					Carrier: "",
					Service: "",
					Settings: this.getModel("settings").getProperty("/DefaultProfileSetting")
				},
				Packmaterial: sPackingMaterial,
				Contents: [],
				FreightUnits: aFreighUnits,
				CarrierProfile: this.getModel("local").getProperty("/CarrierProfile")
			};
			return oData;
		},

		_resetData: function () {
			var oTxtInput = this.byId("txtId");
			var oTxtItem = this.byId("txtItem");
			var oTxtQty = this.byId("txtQty");
			var oTxtExt = this.byId("txtExt");
			oTxtInput.removeAllTokens();
			// Enable inputs fields
			oTxtInput.setEditable(true);
			oTxtItem.setValue("");
			oTxtItem.setEnabled(false);
			oTxtQty.setEnabled(false);
			oTxtQty.setEditable(false);
			oTxtQty.setValueState("None");
			oTxtQty.setValue("");
			oTxtExt.setValue("");
			oTxtItem.setValueState("None");
			this.getModel("local").setData({});
			this.hideBusy();
		},

		onDeleteHU: function () {
			var aItems = this.oHUTab.getSelectedItems();
			var i;
			if (aItems.length === 0) {
				return;
			}
			var aHUs = this.getModel("local").getProperty("/HUs");
			for (i = 0; i < aItems.length; i++) {
				var oData = aItems[i].getBindingContext("local").getObject();
				for (var j = 0; j < aHUs.length; j++) {
					if (aHUs[j].HandlingUnit === oData.HandlingUnit && aHUs[j].TrackingNumber === "") {
						aHUs[j].SelectedFlag = true;
						break;
					}
				}
			}

			MessageBox.confirm(this.oBundle.getText("DeleteConfirm"), {
				title: "Delete HU", // default
				actions: [MessageBox.Action.YES, MessageBox.Action.NO],
				onClose: function (oAction) {
					if (oAction === MessageBox.Action.YES) {
						this._deleteHUs(aHUs);
					}
				}.bind(this)
			});
		},

		onDeleteAllHU: function () {
			var aHUs = this.getModel("local").getProperty("/HUs");
			if (aHUs.length === 0) {
				return;
			}
			for (var i = 0; i < aHUs.length; i++) {

				aHUs[i].SelectedFlag = true;
			}

			var bEmptyTrackNum = aHUs.every(function (item) {
				return (item.TrackingNumber === "");
			});
			if (!bEmptyTrackNum) {
				MessageBox.error(this.oBundle.getText("DeleteHaveTrackNum"));
				return;
			}
			MessageBox.confirm(this.oBundle.getText("DeleteAllConfirm"), {
				title: "Delete All HUs", // default
				actions: [MessageBox.Action.YES, MessageBox.Action.NO],
				onClose: function (oAction) {
					if (oAction === MessageBox.Action.YES) {
						this._deleteHUs(aHUs);
					}
				}.bind(this)
			});
		},

		onSearchMaterial: function (oEvt) {
			var sQuerry = oEvt.getSource().getValue();
			var aFilter = [];
			if (sQuerry && sQuerry.length > 0) {
				aFilter.push(new Filter("Material", sap.ui.model.FilterOperator.Contains, sQuerry));
			}
			var oBinding = this.oContentTab.getBinding("items");
			oBinding.filter(aFilter);
		},

		onUpdateDomestic: function (oEvent) {
			var oControl = oEvent.getSource();
			var sCountryCode = oControl.getSelectedKey();
			var sRegionId = oControl.data("nextUpdate");
			if (sRegionId) {
				this._updateRegion(sRegionId, sCountryCode);
			}
		},

		onCarrierChange: function (oEvent) {
			var oControl = oEvent.getSource();
			var sCarrierKey = oControl.getSelectedKey();
			var oService = this.byId("selectService");
			oService.getBinding("items").filter(new Filter("Scac", "EQ", sCarrierKey));
			oService.setSelectedKey();
			this._scanCarierService(this.sDocumentID);
		},
		onExecute: function (oEvent) {
			this._execute();
		},

		/* =========================================================== */
		/* internal methods                                            */
		/* =========================================================== */
		_execute: function () {
			this.showBusy();
			var oRequestData = this._generateExecuteUsecase();
			this.getModel().create("/InputQuerySet", oRequestData, {
				success: function (oData) {

					this.hideBusy();
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

		_generateExecuteUsecase: function () {
			var oData = {

			};
			return oData;
		},

		_updateRegion: function (sId, sCountry) {
			var oRegionControl = this.byId(sId);
			oRegionControl.getBinding("items").filter(new Filter("Country", "EQ", sCountry));
			oRegionControl.setSelectedKey("");
		},

		getHotKeysHandlers: function () {
			var oView = this.getView();
			var aHotKeyHandlers = [{
				keyCombination: "F2",
				control: this.byId("btnAddHU"),
				fnHandler: this.handleButtonPress,
				hanlder: this
			}, {
				keyCombination: "Shift+F5",
				control: this.byId("btnResetData"),
				fnHandler: this.handleButtonPress,
				hanlder: this
			}, {
				keyCombination: "F6",
				control: this.byId("btnPack"),
				fnHandler: this.handleButtonPress,
				hanlder: this
			}, {
				keyCombination: "F7",
				control: this.byId("btnDeleteHU"),
				fnHandler: this.handleButtonPress,
				hanlder: this
			}, {
				keyCombination: "F8",
				control: this.byId("btnCreateShipment"),
				fnHandler: this.handleButtonPress,
				hanlder: this
			}, {
				keyCombination: "Shift+F6",
				control: this.byId("btnPackPartial"),
				fnHandler: this.handleButtonPress,
				hanlder: this
			}];
			return aHotKeyHandlers;
		},

		handleButtonPress: function (oEvent, oControl) {
			if (oControl.getVisible() && oControl.getEnabled()) {
				oControl.firePress();
			}
		},

		unBindAllHotKeys: function () {
			HotkeyInterface.getInstance(this.getOwnerComponent()).unBindHotKeys(this.getHotKeysHandlers());
		},

		getProfileConfig: function () {
			var sPath = this.getModel().createKey("/xSERPERPxI_QP_PF", {
				Profile: this.sProfile
			});
			this.showBusy();
			this.getModel().read(sPath, {
				success: function (oData) {
					if (oData) {
						delete oData.__metadata;
						this.getModel("settings").setProperty("/DefaultProfileSetting", oData);
					} else {
						this.getModel("settings").setProperty("/DefaultProfileSetting", {});
					}
					this.oDefaultProfileSettingDeferred.resolve();
					this.bAutoPack = this.getModel("settings").getProperty("/DefaultProfileSetting/AutoPack");
					this.sQuantitySelection = this.getModel("settings").getProperty("/DefaultProfileSetting/QuantitySelection");
					if (this.sQuantitySelection === "3" && this.bAutoPack === true) {
						MessageBox.warning(this.oBundle.getText("AutoPackUserInput"));
					}
					this.hideBusy();
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

		_deleteHUs: function (aSelectedHUs) {
			this.showBusy();
			var oRequestData = this._generateDeleteHUUsecase(aSelectedHUs);
			this.getModel().create("/InputQuerySet", oRequestData, {
				success: function (oData) {
					if (oData) {
						if (oData.Contents) {
							this.getModel("local").setProperty("/Contents", oData.Contents.results || []);
						} else {
							this.getModel("local").setProperty("/Contents", []);
						}
						if (oData.FreightUnits) {
							this.getModel("local").setProperty("/HUs", oData.FreightUnits.results);
						} else {
							this.getModel("local").setProperty("/HUs", []);
						}
					}
					this._selectLastHU();
					this.hideBusy();
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

		_generateDeleteHUUsecase: function (aHUs) {
			var sAction = "DeleteHUs";

			for (var i = 0; i < aHUs.length; i++) {
				if (!aHUs[i].FreightUnitItemSet) {
					aHUs[i].FreightUnitItemSet = [];
				}
			}

			var oData = {
				Action: sAction,
				DocumentID: this.sDocumentID,
				Material: "",
				Basic: {
					Profile: this.sProfile,
					Shipstation: this.sStation,
					Carrier: "",
					Service: "",
					Settings: this.getModel("settings").getProperty("/DefaultProfileSetting")
				},
				Contents: this.getModel("local").getProperty("/Contents"),
				FreightUnits: aHUs,
				CarrierProfile: this.getModel("local").getProperty("/CarrierProfile")
			};
			return oData;
		},

		_scanCarierService: function (sDocumentID) {
			this.showBusy();
			var oRequestData = this._generateCarrierServiceUsecase(sDocumentID);
			this.getModel().create("/InputQuerySet", oRequestData, {
				success: function (oData) {
					if (oData) {
						if (oData.Basic) {
							this.getModel("local").setProperty("/Basic", oData.Basic);
						} else {
							this.getModel("local").setProperty("/Basic", {});
						}
						// if (oData.CarrierListSet) {
						// 	this.getModel("local").setProperty("/CarrierListSet", oData.CarrierListSet.results);
						// } else {
						// 	this.getModel("local").setProperty("/CarrierListSet", []);
						// }
						// if (oData.ServiceListSet) {
						// 	this.getModel("local").setProperty("/ServiceListSet", oData.ServiceListSet.results);
						// } else {
						// 	this.getModel("local").setProperty("/ServiceListSet", []);
						// }
						// if (oData.CarrierProfile) {
						// 	this.getModel("local").setProperty("/CarrierProfile", oData.CarrierProfile);
						// } else {
						// 	this.getModel("local").setProperty("/CarrierProfile", {});
						// }
						// this.getModel("local").setProperty("/Address", oData.Address || {});
					}
					this.mappingAddress();
					this.mappingService();
					this.hideBusy();
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

		_generateCarrierServiceUsecase: function (sDocumentID) {
			var sAction = "ChangeCarrier";
			var oData = {
				Action: sAction,
				DocumentID: this.sDocumentID,
				Material: "",
				Basic: {
					Profile: this.sProfile,
					Shipstation: this.sStation,
					Carrier: this.byId("cbCarrier").getSelectedKey(),
					Service: "",
					Settings: this.getModel("settings").getProperty("/DefaultProfileSetting")
				},
				Contents: this.getModel("local").getProperty("/Contents"),
				CarrierProfile: this.getModel("local").getProperty("/CarrierProfile")
			};
			return oData;
		}

	});
});