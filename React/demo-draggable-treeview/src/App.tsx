
//import styles from './App.css';

import React from "react";
import TreeView from "./TreeView";

function randomName(root: string) {
  return root + Math.floor(Math.random() * 100);
}

class Employee {
    name: string = randomName("emp")
    knickknacks: string[] = ["tag"]
}

class Company
{
    name: string = randomName("company")
    employees: Employee[] = [new Employee()]
}



export default class App extends React.Component<{}> {
    render() {
        const items = [new Company(), new Company()];

        const renderCompany = (item: Company) => {
          return <div>Company: {item.name}</div>
        }
        const renderEmployee = (item: Employee) => {
          return <div>Employee: {item.name}</div>
        }
        const renderKnickKnack = (item: string) => {
          return <div>KK: {item}</div>
        }

        const queryItem = (item: any, itemType: string) => {

          let children: any[] | null = null
          switch(itemType)
          {
              case "Company":  
                return {
                  children: (item as Company).employees,
                  renderer: renderCompany,
                  getChildItemType: () => "Employee"
                }
              case "Employee": 
                return {
                  children: (item as Employee).knickknacks,
                  renderer: renderEmployee,
                  getChildItemType: () => "KnickKnack"
                }
              case "KnickKnack": 
                return {
                  children: null,
                  renderer: renderKnickKnack,
                  getChildItemType: () => ""
                }
          }
          throw Error(`unknown Item type: ${itemType}`)
        }

        return <div>
            <div>Hello</div>
            <button>ExpandAll</button>
            <div style={{border: "1px solid green"}}>
              <TreeView
                itemsSource={items}
                itemQuery={queryItem}
                getItemType={()=>"Company"}
              />              
            </div>

        </div>
    }
}