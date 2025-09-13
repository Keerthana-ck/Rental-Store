// Copyright (c) 2025, Keerthana and contributors
// For license information, please see license.txt

frappe.ui.form.on("Rental Item Mangement", {
    onload: function(frm) {
        frm.fields_dict["rental_items"].grid.get_field("item").get_query = function(doc, cdt, cdn) {
            return {
                filters: {
                    "custom_rental_item": 1
                }
            };
        };
        // calculate_total_rental_amount(frm);
    },
    start_date: function(frm) {
        calculate_rental_days(frm);
    },
    end_date: function(frm) {
        calculate_rental_days(frm);
    },
    refresh: function(frm){
      // calculate_total_rental_amount(frm);
      if (frm.doc.status === "Issued") {
           frm.add_custom_button(
               __("Sales Invoice"),
               function() {
                   frappe.model.open_mapped_doc({
                       method: "rental_store.rental_store.doctype.rental_item_mangement.rental_item_mangement.make_balance_sales_invoice",
                       frm: frm
                   });
               },
               __("Create")
           );
           frm.add_custom_button(__('Send Rental Details via WhatsApp'), function() {
                send_rental_whatsapp(frm);
            }, __("Actions"));
       }

       // if (frm.doc.status === "Return") {
       //         frm.add_custom_button(
       //             __("Balance Invoice"),
       //             function() {
       //                 frappe.model.open_mapped_doc({
       //                     method: "rental_store.rental_store.doctype.rental_item_mangement.rental_item_mangement.make_balance_sales_invoice",
       //                     frm: frm
       //                 });
       //             },
       //             __("Create")
       //         );
       //     }


    },

    // total_amount: function(frm){
    //   calculate_total_rental_amount(frm);
    // },
    // advance_amount : function(frm){
    //   calculate_balance_amount(frm);
    // },
    rental_items_remove: function(frm) {
        calculate_total_damage_rate(frm);
    }
});

// function calculate_balance_amount(frm){
//   let balance_amount = 0;
//   if(frm.doc.total_amount && frm.doc.advance_amount){
//     rental_amount = frm.doc.total_amount;
//     advance_amount = frm.doc.advance_amount;
//     balance_amount = rental_amount - advance_amount;
//     if(balance_amount){
//       frm.set_value("balance_amount", balance_amount);
//     }
//   }
// }

// function calculate_total_rental_amount(frm){
//   let total_rental_amount = 0;
//   if(frm.doc.rental_days && frm.doc.total_amount){
//     rental_days = frm.doc.rental_days;
//     total_amount = frm.doc.total_amount;
//     total_rental_amount = total_amount * rental_days;
//     if (total_rental_amount){
//       frm.set_value("rental_amount", total_rental_amount);
//     }
//   }
// }

function send_rental_whatsapp(frm) {
    if(!frm.doc.phone_number) {
        frappe.msgprint("Customer mobile number is required to send WhatsApp message.");
        return;
    }

    let mobile = frm.doc.phone_number.replace(/\D/g,'');
    let message = `Hello ${frm.doc.customer || ''},\n\nRental Details:\n`;
    (frm.doc.rental_items || []).forEach(function(item, idx) {
        message += `${idx + 1}. ${item.item_name || item.item || item.item_code} - Qty: ${item.qty}, Rate: ${item.rent_rate}, Days: ${item.rental_days}\n`;
    });
    message += `\nTotal Amount: ${frm.doc.total_amount}\nRental Days: ${frm.doc.rental_days}\nThank you!`;

    let encoded_msg = encodeURIComponent(message);
    let whatsapp_url = `https://wa.me/${mobile}?text=${encoded_msg}`;
    window.open(whatsapp_url, "_blank");
}


function calculate_rental_days(frm) {
    if (frm.doc.start_date && frm.doc.end_date) {
        let start = frappe.datetime.str_to_obj(frm.doc.start_date);
        let end = frappe.datetime.str_to_obj(frm.doc.end_date);

        if (end < start) {
            frappe.msgprint("End Date cannot be before Start Date");
            frm.set_value("rental_days", null);
        }

        let days = frappe.datetime.get_diff(end, start) + 1;
        frm.set_value("rental_days", days);
    }
}

frappe.ui.form.on("Rental Item", {
    qty: function(frm, cdt, cdn) {
        calculate_amount(cdt, cdn);
        calculate_total_amount(cdt, cdn);
    },
    rent_rate: function(frm, cdt, cdn) {
        calculate_amount(cdt, cdn);
        calculate_total_amount(cdt, cdn);
    },
    amount: function(frm, cdt, cdn) {
        calculate_total_amount(frm);
    },
    rental_items_remove : function(frm, cdt, cdn){
      let total = 0;
      let d = locals[cdt][cdn];
      frm.doc.rental_items.forEach(function(d){
        total += d.amount;
      })
      frm.set_value('total_amount',total)
    },
    is_damaged: function(frm, cdt, cdn) {
      calculate_total_damage_rate(cdt, cdn);
      let d = locals[cdt][cdn];
      if (d.is_damaged && d.item) {
        frappe.call({
          method: "rental_store.rental_store.doctype.rental_item_mangement.rental_item_mangement.get_damaged_rate",
          args: {
            item_code: d.item
          },
          callback: function(r) {
            if (r.message) {
              frappe.model.set_value(cdt, cdn, "damaged_rate", r.message);
            }
          }
        });
      } else {
        frappe.model.set_value(cdt, cdn, "damaged_rate", 0);
      }
    },
    no_of_damaged_item : function(frm, cdt, cdn){
      calculate_damaged_rate(cdt, cdn);
      calculate_total_damage_rate(cdt, cdn);
    },
    damaged_rate : function(frm, cdt, cdn){
      calculate_damaged_rate(cdt, cdn);
      calculate_total_damage_rate(cdt, cdn);
    },
    rental_items_add: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        if (frm.doc.rental_days) {
            frappe.model.set_value(cdt, cdn, "rental_days", frm.doc.rental_days);
        }
    },
    damage_rate_of_items: function(frm, cdt, cdn) {
      calculate_total_damage_rate(frm);
    }
});

function calculate_damaged_rate(cdt, cdn) {
    let d = locals[cdt][cdn];
    if (d.damaged_rate && d.no_of_damaged_item) {
        frappe.model.set_value(cdt, cdn, "damage_rate_of_items", d.damaged_rate * d.no_of_damaged_item);
    } else {
        frappe.model.set_value(cdt, cdn, "damage_rate_of_items", 0);
        calculate_total_damage_rate(frm);
    }
}

function calculate_amount(cdt, cdn) {
    let d = locals[cdt][cdn];
    if (d.qty && d.rent_rate) {
        frappe.model.set_value(cdt, cdn, "amount", d.qty * d.rent_rate);
    } else {
        frappe.model.set_value(cdt, cdn, "amount", 0);
        calculate_total_amount(frm);
    }
}

function calculate_total_amount(frm) {
    let total = 0;
    (frm.doc.rental_items || []).forEach(function(d) {
        total += parseFloat(d.amount) || 0;
    });
    frm.set_value("total_amount", total);
}

function calculate_total_damage_rate(frm) {
    let total = 0;
    (frm.doc.rental_items || []).forEach(function(d) {
        total += flt(d.damage_rate_of_items);
    });
    frm.set_value("total_damage_rate", total);
}
