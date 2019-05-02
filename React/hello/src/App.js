import React from 'react';
import './App.css';

export default class AppComponent extends React.Component {
  
  constructor(props) {
    super(props);


    this.state = {
        myState: 'Fresh',
        location: 'Hong Kong',
        capacity: 50,
        cash: 5000
     };

  }

  render()  {
      return (
        <div className="App" style={{width: 400}}>
                Taipan++

          {this.getStatus()}
          <div className="regularText">
            Please choose: B)uy S)ell T)ravel
            <input style={{width:1, border: 0}} onChange={this.handleInputChanged.bind(this)} onKeyUp={this.handleKeyUp} />
            <br/>
          </div>
        </div>
      );
  }

  getStatus()
  {
    return (
      <div className="statusBox">
        <div className="regularText">
        Current Location: {this.state.location}
          <br/>
          Date: May 22, 1598
          <br/>
          Ship Capacity: {this.getCargoWeight()}/{this.state.capacity}
          <br/>
          Cash: ${this.state.cash}
          <br/>
          <table style={{margin: 20, border: 1, borderColor: "black"}}>
          <tr>
                <td>Commodity</td>
                <td>In Ship</td>
                <td>In Port</td>
                <td>Price</td>
              </tr>
              <tr>
                <td>Silk</td>
                <td>20</td>
                <td>12</td>
                <td>$2500</td>
              </tr>
              <tr>
                <td>Arms</td>
                <td>0</td>
                <td>100</td>
                <td>$300</td>
              </tr>
              <tr>
                <td>Gold</td>
                <td>0</td>
                <td>2</td>
                <td>$18000</td>
              </tr>
          </table>
        </div>
      </div>);
  }

  getCargoWeight()
  {
    return 22;
  }

  handleInputChanged(args)
  {
    this.setState({myState: args.target.value});
  }

  handleKeyUp(args)
  {
      
  }
}



