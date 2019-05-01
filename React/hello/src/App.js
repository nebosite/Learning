import React from 'react';
import './App.css';

export default class AppComponent extends React.Component {
  
  constructor(props) {
    super(props);


    this.state = {
        myState: 'Fresh'
     };

  }

  render()  {
      return (
        <div className="App">
          <div className="regularText">
            Please type something:
            <input onChange={this.handleInputChanged.bind(this)} onKeyUp={this.handleKeyUp} />
            <br/>
            State: {this.state.myState}
          </div>
        </div>
      );
  }

  handleInputChanged(args)
  {
    this.setState({myState: args.target.value});
  }

  handleKeyUp(args)
  {
      
  }
}



