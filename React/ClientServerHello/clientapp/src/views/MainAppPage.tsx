// App Navigation handled here
import React from "react";
import { inject, observer } from "mobx-react";
import styles from '../AppStyles.module.css';
import { AppModel } from "models/AppModel";

@inject("appModel")
@observer
export class MainAppPage 
extends React.Component<{appModel?: AppModel}> 
{    
  // -------------------------------------------------------------------
  // render
  // -------------------------------------------------------------------
  render() {
    const {appModel} = this.props;

    const pingServer = () => appModel.ping();

    return ( 
        <div className={styles.mainPage}>
            <div>Hello</div>
            <button onClick={pingServer}>Ping Server</button>
            <div>{appModel.pingResult}</div>
        </div>        
    );
  }
}
