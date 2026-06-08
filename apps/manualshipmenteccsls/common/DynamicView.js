sap.ui.define(["sap/ui/layout/form/SimpleForm", "com/erpis/shiperp/sls/manualsls/common/ControlUtils",
	"com/erpis/shiperp/sls/manualsls/common/Utils"
], function (SimpleForm, ControlUtils, Utils) {
	"use strict";
	return {
		/**Render dynamic fields for more option view package level
		 * */
		renderMoreOptionForm: function (aSourceFields, oController, bDeep) {
			if (aSourceFields.length > 0) {
				var oMoreOptionForm = this.renderMoreOptionFormContent(aSourceFields, oController, bDeep, false);
				oController.oMoreOptionDialog.addContent(oMoreOptionForm);
			}
		},
		/**
		 * render form for shipment level
		 **/
		renderShipmentCarrierOptionForm: function (aSourceFields, oController, bDeep) {
			if (aSourceFields.length > 0) {
				var oShipmentMoreOptionForm = this.renderMoreOptionFormContent(aSourceFields, oController, bDeep, true);
				oController.oShipmentCarrierOptionTab.addBlock(oShipmentMoreOptionForm);
			}
		},
		/**
		 * @param: bShipment - true is for shipment level; false for package level
		 * */
		renderMoreOptionFormContent: function (aOriginalSourceFields, oController, bDeep, bShipment) {
			var aRootFields = Utils._getExistItemsArray(aOriginalSourceFields, "FieldPName", "");
			var aSourceFields = Utils._removeDuplicateObjInArr(aRootFields, "FieldName"); //remove duplicate record prevent dup items on UI
			//check deep items
			if (bDeep === true) {
				aSourceFields = aOriginalSourceFields;
			}
			if (aSourceFields.length > 0) {
				var oMoreOptionForm = new SimpleForm({
					width: "auto",
					editable: true,
					layout: "ResponsiveGridLayout",
					labelSpanXL: 6,
					labelSpanL: 6,
					labelSpanM: 6,
					labelSpanS: 4,
					columnsXL: 4,
					columnsL: 4,
					columnsM: 3
				}).addStyleClass("border_lightgray sapUiSmallMarginBottom");
				var sFieldGroup = "";
				for (var i = 0; i < aSourceFields.length; i++) {
					if (aSourceFields[i].FieldGroup !== sFieldGroup && aSourceFields[i].Sequence === "01") {
						var oTitle = new sap.ui.core.Title({
							text: aSourceFields[i].GroupText
						});
						oMoreOptionForm.addContent(oTitle);
						sFieldGroup = aSourceFields[i].FieldGroup;
					}
					if (aSourceFields[i].CarrCode === "" || aSourceFields[i].FieldName === "") {
						continue;
					}
					var oLabel = ControlUtils.Label(aSourceFields[i].FieldDesc);
					if (aSourceFields[i].FieldType !== "08") {
						oMoreOptionForm.addContent(oLabel);
					}

					//Build dynamic fields
					var thisInstance = this;
					var oSourceField = Object.assign({}, aSourceFields[i]);
					oSourceField.ComboboxValues = (aSourceFields[i].value_list) ? aSourceFields[i].value_list.results : []; //set data for combobox
					//Add event for checkbox if FieldValue2 not null
					if (aSourceFields[i].FieldType === "02" && aSourceFields[i].FieldValue2 !== "") {
						//add checkbox event to enable disable button
					}
					//Field type button event handler
					if (aSourceFields[i].FieldType === "08") {
						oSourceField.FnCallback = function (data) {
							var aDeepFields = Utils._getExistItemsArray(aOriginalSourceFields, "FieldPName", data.key);
							if (aDeepFields.length > 0) {
								thisInstance.isShipment = bShipment;
								var oMoreOptionChild = thisInstance.renderMoreOptionFormContent(aDeepFields, oController, true, bShipment);
								thisInstance.renderDialog(oMoreOptionChild, data.key, data.text, oController, thisInstance);
							}
						};
					}

					var oFieldBase = ControlUtils.BuildControlByType(oSourceField, oController);
					// Disable option before add to content
					if (aSourceFields[i].DisplayOption === "1" || aSourceFields[i].DisplayOption === "2") {
						if (aSourceFields[i].DisplayOption === "2") {
							oLabel.setRequired(true);
						} else {
							oLabel.setRequired(false);
						}
						oFieldBase.setEnabled(true);
					} else {
						//Axo 6913
						oFieldBase.setEditable(false);
					}
					//Axo 4770
					if (oController.isCanShip === false) {
						oFieldBase.setEnabled(false);
					}
					oFieldBase.setWidth("auto");
					oMoreOptionForm.addContent(oFieldBase);
				} //end loop

				return oMoreOptionForm;
			}
			return null;
		},
		renderDialog: function (oContent, deepId, sTitle, oController, oDynamicInstance) {

			//remove old dialog to avoid duplicate
			if (oController._deepFormDialog) {
				oController._deepFormDialog.destroy();
				oController._deepFormDialog = null;
			}
			//create new dialog
			oController._deepFormDialog = new sap.m.Dialog({
				id: deepId,
				title: sTitle,
				content: oContent,
				state: "Success",
				stretch: true,
				endButton: new sap.m.Button({
					text: "Close",
					press: function () {
						if (oController._deepFormDialog.getContent()[0]) {
							oDynamicInstance.getDynamicDataForDialog(oController._deepFormDialog, oController, oDynamicInstance, false);
						}
						oController._deepFormDialog.close();
						oController._deepFormDialog.destroy();
					}
				})
			});
			oController.getView().addDependent(oController._deepFormDialog);
			oController._deepFormDialog.open();

		},
		//get dynamic data for package level
		getDynamicDataForDialog: function (oDialogInstance, oController, oDynamicInstance, isDeep) {

			if (oDialogInstance === null) {
				return;
			}
			if (oDialogInstance.getContent()[0]) {
				var aControls = oDialogInstance.getContent()[0].getContent();
				if (aControls.length > 0) {
					if (!oDynamicInstance.isShipment) {
						//for package level
						if (!oController.currentFUPath) {
							return;
						}
						var oFreightUnitItemRow = oController.getModel("local").getProperty(oController.currentFUPath);
						for (var i = 0; i < aControls.length; i++) {
							if (!(aControls[i] instanceof sap.m.Button || aControls[i] instanceof sap.m.Label || aControls[i] instanceof sap.ui.core.Title)) {
								oDynamicInstance._getDataFromDynamicControl(aControls[i], oFreightUnitItemRow, "PACKAGE");
							}
						}

						oController.getModel("local").setProperty(oController.currentFUPath, oFreightUnitItemRow);
					} else {
						//for shipment level
						var oShipmentCarrierOptions = oController.getModel("local").getProperty("/ShipmentCarrierOptions");
						for (var s = 0; s < aControls.length; s++) {
							if (!(aControls[s] instanceof sap.m.Button || aControls[s] instanceof sap.m.Label || aControls[s] instanceof sap.ui.core.Title)) {
								oDynamicInstance._getDataFromDynamicControl(aControls[s], oShipmentCarrierOptions, "SHIPMENT");
							}
						}

						oController.getModel("local").setProperty("/ShipmentCarrierOptions", oShipmentCarrierOptions);

					}

				}
			}
		},

		//get dynamic data for shipment level
		getDynamicDataForShipmentCarrierOptionForm: function (oForm, oController, oDynamicInstance) {

			if (oForm.getContent()[0]) {
				var aControls = oForm.getContent();
				if (aControls.length > 0) {
					var oShipmentCarrierOptions = oController.getModel("local").getProperty("/ShipmentCarrierOptions");
					for (var i = 0; i < aControls.length; i++) {
						if (!(aControls[i] instanceof sap.m.Button || aControls[i] instanceof sap.m.Label || aControls[i] instanceof sap.ui.core.Title)) {
							oDynamicInstance._getDataFromDynamicControl(aControls[i], oShipmentCarrierOptions, "SHIPMENT");
						}
					}

					oController.getModel("local").setProperty("/ShipmentCarrierOptions", oShipmentCarrierOptions);
				}
			}
		},

		_getDataFromDynamicControl: function (oControl, oSource, sLevel) {
			var sFieldName = oControl.getId(),
				sValue1 = "",
				sValue2 = "";
			//remove prefix
			sFieldName = sFieldName.replaceAll("PACKAGE_", "").replaceAll("SHIPMENT_", "");

			if (oControl instanceof sap.m.CheckBox) {
				sValue1 = oControl.getSelected() ? "X" : "";
			} else if (oControl instanceof sap.m.ComboBox) {
				sValue1 = oControl.getSelectedKey();
			} else if (oControl instanceof sap.m.Input) {
				sValue1 = oControl.getValue();
			} else if (oControl instanceof sap.m.DateRangeSelection) {
				var dateFormat = sap.ui.core.format.DateFormat.getDateInstance({
					pattern: "yyyyMMdd"
				});
				sValue1 = dateFormat.format(oControl.getDateValue());
				sValue2 = dateFormat.format(oControl.getSecondDateValue());
			} else if (oControl instanceof sap.m.DatePicker) {
				sValue1 = oControl.getValue();
			} else if (oControl instanceof sap.m.RadioButton) {
				sValue1 = oControl.getSelected();
			} else if (oControl instanceof sap.m.TimePicker) {
				sValue1 = oControl.getValue();
			}
			this._updateMoreOptionData(oSource, sFieldName, sValue1, sValue2, sLevel);
		},
		_updateMoreOptionData: function (oSource, sFieldName, sValue1, sValue2, sLevel) {
			if (!sFieldName) {
				return;
			}
			//process for package
			if (sLevel === "PACKAGE") {
				for (var i = 0; i < oSource.carrier_more_option.results.length; i++) {
					var packageFieldName = oSource.carrier_more_option.results[i].FieldName;
					packageFieldName = packageFieldName.replaceAll("PACKAGE_", "").replaceAll("SHIPMENT_", "");
					if (packageFieldName === sFieldName) {
						oSource.carrier_more_option.results[i].FieldValue1 = sValue1;
						oSource.carrier_more_option.results[i].FieldValue2 = sValue2;
						break;
					}
				}

			}

			//process for shipment
			if (sLevel === "SHIPMENT") {
				for (var s = 0; s < oSource.length; s++) {
					var shipmentFieldName = oSource[s].FieldName;
					shipmentFieldName = shipmentFieldName.replaceAll("PACKAGE_", "").replaceAll("SHIPMENT_", "");
					if (shipmentFieldName === sFieldName) {
						oSource[s].FieldValue1 = sValue1;
						oSource[s].FieldValue2 = sValue2;
						break;
					}
				}
			}
		},
		removePrefixBeforeExecute: function (aSources) {
			aSources.forEach(function (item) {
				item.FieldName = item.FieldName.replaceAll("PACKAGE_", "").replaceAll("SHIPMENT_", "");
			});
			return aSources;
		},
		removePrefixPackage: function (oController) {
			var aFreightUnits = oController.getModel("local").getProperty("/Freightunits");
			var oThis = this;
			aFreightUnits.forEach(function (fuItem) {
				fuItem.carrier_more_option.results = oThis.removePrefixBeforeExecute(fuItem.carrier_more_option.results);
			});
			oController.getModel("local").setProperty("/Freightunits", aFreightUnits);
		},
		removePrefixShipment: function (oController) {
				var aShipmentCarrierOptions = oController.getModel("local").getProperty("/ShipmentCarrierOptions");
				aShipmentCarrierOptions = this.removePrefixBeforeExecute(aShipmentCarrierOptions);
				oController.getModel("local").setProperty("/ShipmentCarrierOptions", aShipmentCarrierOptions);

			} //end

	};
});