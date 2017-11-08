/**
 * Contract artifacts
 * @TODO: Implement event driven tests
 */
const IcoToken  = artifacts.require('./IcoToken');
const moment    = require('moment'); // eslint-disable-line
const BigNumber = web3.BigNumber;

const should = require('chai') // eslint-disable-line
    .use(require('chai-as-promised'))
    .use(require('chai-bignumber')(BigNumber))
    .should();

/**
 * Expect exception throw above call of assertJump()
 *
 * @param {string} error Expected error
 * @return {undefined}
 */
function assertJump(error) {
    assert.isAbove(error.message.search('invalid opcode'), -1, 'Invalid opcode error must be returned');
}

/**
 * Increase N days in testrpc
 *
 * @param {integer} days Number of days
 * @return {integer} Time
 */
async function waitNDays(days) {
    const daysInSeconds = days * 24 * 60 * 60;

    const time = await web3.currentProvider.send({
        jsonrpc: '2.0',
        method: 'evm_increaseTime',
        params: [daysInSeconds],
        id: 4447
    });

    return time.result;
}

contract('IcoToken', (accounts) => {
    const owner                 = accounts[0];
    const activeTreasurer1      = accounts[1];
    const activeTreasurer2      = accounts[2];
    const inactiveTreasurer1    = accounts[3];
    const inactiveTreasurer2    = accounts[4];
    const tokenHolder1          = accounts[5];
    const tokenHolder2          = accounts[6];

    // Provide icoTokenInstance for every test case
    let icoTokenInstance;
    beforeEach(async () => {
        icoTokenInstance = await IcoToken.deployed();
    });

    /**
     * Debug function
     * @return {undefined}
     */
    debug = async () => {
        console.log('==========================================');

        // @TODO: bignumber
        console.log('ETH getBalance icoTokenInstance: ' + Math.ceil(web3.fromWei(web3.eth.getBalance(icoTokenInstance.address)).toNumber()));
        console.log('ETH getBalance tokenHolder1: ' + Math.ceil(web3.fromWei(web3.eth.getBalance(tokenHolder1)).toNumber()));
        console.log('ETH getBalance tokenHolder2: ' + Math.ceil(web3.fromWei(web3.eth.getBalance(tokenHolder2)).toNumber()));

        const icoTokenInstanceBalance   = await icoTokenInstance.balanceOf(icoTokenInstance.address);
        const tokenHolder1Balance       = await icoTokenInstance.balanceOf(tokenHolder1);
        const tokenHolder2Balance       = await icoTokenInstance.balanceOf(tokenHolder2);

        console.log('------------------------------------------');

        console.log('balanceOf icoTokenInstance: ' + icoTokenInstanceBalance.toNumber());
        console.log('balanceOf tokenHolder1: ' + tokenHolder1Balance.toNumber());
        console.log('balanceOf tokenHolder2: ' + tokenHolder2Balance.toNumber());

        console.log('==========================================');
    };

    /**
     * [ Claim period ]
     */

    it('should instantiate the ICO token correctly', async () => {
        console.log('[ Claim period ]');

        const isOwnerTreasurer      = await icoTokenInstance.isTreasurer(owner);
        const isOwnerAccountZero    = await icoTokenInstance.owner() === owner;

        assert.isTrue(isOwnerAccountZero, 'Owner is not the first account: ' + icoTokenInstance.owner());
        assert.isTrue(isOwnerTreasurer, 'Owner is not a treasurer');
    });

    it('should add treasurer accounts', async () => {
        await icoTokenInstance.setTreasurer(activeTreasurer1, true);
        await icoTokenInstance.setTreasurer(activeTreasurer2, true);
        await icoTokenInstance.setTreasurer(inactiveTreasurer1, false);
        await icoTokenInstance.setTreasurer(inactiveTreasurer2, false);

        const treasurer1 = await icoTokenInstance.isTreasurer(activeTreasurer1);
        const treasurer2 = await icoTokenInstance.isTreasurer(activeTreasurer2);
        const treasurer3 = await icoTokenInstance.isTreasurer(inactiveTreasurer1);
        const treasurer4 = await icoTokenInstance.isTreasurer(inactiveTreasurer2);

        assert.isTrue(treasurer1, 'Treasurer 1 is not active');
        assert.isTrue(treasurer2, 'Treasurer 2 is not active');
        assert.isFalse(treasurer3, 'Treasurer 3 is not inactive');
        assert.isFalse(treasurer4, 'Treasurer 4 is not inactive');
    });

    it('should mint 5 tokens for each token holder', async () => {
        let balanceTokenHolder1 = await icoTokenInstance.balanceOf(tokenHolder1);
        let balanceTokenHolder2 = await icoTokenInstance.balanceOf(tokenHolder2);
        let totalSupply         = await icoTokenInstance.totalSupply();

        assert.equal(balanceTokenHolder1, 0, 'Wrong token balance of tokenHolder1 (is not 0): ' + balanceTokenHolder1);
        assert.equal(balanceTokenHolder2, 0, 'Wrong token balance of tokenHolder2 (is not 0): ' + balanceTokenHolder2);
        assert.equal(totalSupply, 0, 'Wrong total supply (is not 0): ' + totalSupply);

        await icoTokenInstance.mint(tokenHolder1, 5);
        await icoTokenInstance.mint(tokenHolder2, 5);

        balanceTokenHolder1 = await icoTokenInstance.balanceOf(tokenHolder1);
        balanceTokenHolder2 = await icoTokenInstance.balanceOf(tokenHolder2);
        totalSupply         = await icoTokenInstance.totalSupply();

        assert.equal(balanceTokenHolder1, 5, 'Wrong token balance of tokenHolder1 (is not 5): ' + balanceTokenHolder1);
        assert.equal(balanceTokenHolder2, 5, 'Wrong token balance of tokenHolder2 (is not 5): ' + balanceTokenHolder2);
        assert.equal(totalSupply, 10, 'Wrong total supply (is not 10): ' + totalSupply);
    });

    it('should start a new dividend round with a balance of 10 eth', async () => {
        // Initialize first dividend round with a volume of 10 eth
        await web3.eth.sendTransaction({
            from:   owner,
            to:     icoTokenInstance.address,
            value:  web3.toWei(10, 'ether'),
            gas:    200000
        });

        // Get ICO balance
        const icoBalance    = await icoTokenInstance.currentDividend();
        const endTime       = await icoTokenInstance.endTime();

        assert.equal(
            web3.fromWei(icoBalance.toNumber()),
            10,
            'Dividend balance is not equal to 10 eth: ' + web3.fromWei(icoBalance.toNumber())
        );

        // @TODO: Test dividend end time more exclicit with MomentJS
        assert.isTrue(endTime > 0, 'EndTime not properly setted: ' + endTime);
    });

    it('should increase dividend balance to 30 eth with different authorized accounts', async () => {
        // Increase dividend as owner
        await web3.eth.sendTransaction({
            from:   owner,
            to:     icoTokenInstance.address,
            value:  web3.toWei(10, 'ether'),
            gas:    200000
        });

        // Increase dividend as treasurer
        await web3.eth.sendTransaction({
            from:   activeTreasurer1,
            to:     icoTokenInstance.address,
            value:  web3.toWei(10, 'ether'),
            gas:    200000
        });

        // Get ICO balance
        const icoBalance = await icoTokenInstance.currentDividend();

        assert.equal(
            web3.fromWei(icoBalance.toNumber()),
            30,
            'Dividend balance is not equal to 30 eth: ' + icoBalance.toNumber()
        );
    });

    it('should fail, because we try to increase dividend balance with a non treasurer account', async () => {
        try {
            await web3.eth.sendTransaction({
                from:   tokenHolder1,
                to:     icoTokenInstance.address,
                value:  web3.toWei(1, 'ether'),
                gas:    200000
            });

            assert.fail('should have thrown before');
        } catch (e) {
            assertJump(e);
        }
    });

    it('should fail, because we try to increase dividend balance with a deactivated treasurer account', async () => {
        try {
            await web3.eth.sendTransaction({
                from:   inactiveTreasurer1,
                to:     icoTokenInstance.address,
                value:  web3.toWei(1, 'ether'),
                gas:    200000
            });

            assert.fail('should have thrown before');
        } catch (e) {
            assertJump(e);
        }
    });

    it('should fail, because requestUnclaimed() is called, but the reclaim period has not begun.', async () => {
        try {
            await icoTokenInstance.requestUnclaimed({from: owner});

            assert.fail('should have thrown before');
        } catch (e) {
            assertJump(e);
        }
    });

    it('should claim tokens', async () => {
        let gas;

        const fundsTokenBefore      = web3.eth.getBalance(icoTokenInstance.address);
        const fundsHolder1Before    = web3.eth.getBalance(tokenHolder1);
        const fundsHolder2Before    = web3.eth.getBalance(tokenHolder2);

        await icoTokenInstance.claimDividend({from: tokenHolder1});
        await icoTokenInstance.claimDividend({from: tokenHolder2});

        const unclaimedDividend = await icoTokenInstance.unclaimedDividend(tokenHolder1);

        const fundsTokenAfter   = web3.eth.getBalance(icoTokenInstance.address);
        const fundsHolder1After = web3.eth.getBalance(tokenHolder1);
        const fundsHolder2After = web3.eth.getBalance(tokenHolder2);

        assert.equal(unclaimedDividend, 0, 'Unclaimed dividend should be 0, but is: ' + unclaimedDividend);

        gas = 30000000000000000000 - 29987230200000000000;
        (fundsHolder1After.plus(fundsHolder2After))
            .minus((fundsHolder1Before.plus(fundsHolder2Before)))
            .plus(gas).should.be.bignumber.equal(fundsTokenBefore);

        assert.equal(fundsTokenAfter.toNumber(), 0, 'Token funds are not equal to 0: ' + fundsTokenAfter.toNumber());

        // @FIXME:
        // gas = 172271731199999000000 - 162265346299999000000;
        // assert.equal(fundsHolder1After, fundsHolder1Before + 15, 'Wrong funds of tokenHolder1: ' + fundsHolder1After);

        // fundsHolder1Before.plus(web3.toWei(15)).plus(gas).should.be.bignumber.equal(fundsHolder1After);

        // console.log(web3.toWei(15)); // 15000000000000000000

        // assert.equal(fundsHolder2After, fundsHolder2Before + 15, 'Wrog funds of tokenHolder2: ' + fundsHolder2After);
    });

    it('should transfer dividend of tokenHolder1 to tokenHolder2 using the transfer method', async () => {
        const tokenHolder1Balance1  = await icoTokenInstance.balanceOf(tokenHolder1);
        const tokenHolder2Balance1  = await icoTokenInstance.balanceOf(tokenHolder2);

        await icoTokenInstance.transfer(tokenHolder2, 5, {from: tokenHolder1});

        const tokenHolder2Balance2  = await icoTokenInstance.balanceOf(tokenHolder2);

        assert.equal(
            tokenHolder2Balance1.toNumber() + tokenHolder1Balance1.toNumber(),
            tokenHolder2Balance2.toNumber(),
            'Excpected value should be 5, but is: ' + (tokenHolder2Balance1.toNumber() + tokenHolder1Balance1.toNumber())
        );
    });

    it.skip('should transfer dividend of tokenHolder2 to tokenHolder1 using the transferFrom method', async () => {
        await debug();

        // const tokenHolder1Balance1  = await icoTokenInstance.balanceOf(tokenHolder1);
        // const tokenHolder2Balance1  = await icoTokenInstance.balanceOf(tokenHolder2);

        // function allowance(address _owner, address _spender) public constant returns (uint256 remaining) {
        const allow1 = await icoTokenInstance.allowance(tokenHolder1, tokenHolder2);
        console.log(allow1.toNumber());

        // function approve(address _spender, uint256 _value) public returns (bool) {
        const approval = await icoTokenInstance.approve(tokenHolder2, 5, {from: tokenHolder1});
        console.log(approval.logs.args);

        const allow2 = await icoTokenInstance.allowance(tokenHolder1, tokenHolder2);
        console.log(allow2.toNumber());

        // function transferFrom(address _from, address _to, uint256 _value) public returns (bool) {
        // @FIXME:
        const transfer = await icoTokenInstance.transferFrom(tokenHolder2, tokenHolder1, 5, {from: tokenHolder2});
        console.log(transfer);

        // const tokenHolder2Balance2  = await icoTokenInstance.balanceOf(tokenHolder2);

        await debug();

        // assert.equal(
        //     tokenHolder2Balance1.toNumber() + tokenHolder1Balance1.toNumber(),
        //     tokenHolder2Balance2.toNumber(),
        //     'Excpected value should be 5, but is: ' + (tokenHolder2Balance1.toNumber() + tokenHolder1Balance1.toNumber())
        // );
    });

    /**
     * [ Reclaim period ]
     */

    it('should turn the time 330 days forward to reclaim period', async () => {
        console.log('[ Reclaim period ]');
        await waitNDays(330);
        // @TODO: test the timestamps
    });

    it('should fail, because we try to call claimDividend() after the claim period is over', async () => {
        try {
            await icoTokenInstance.claimDividend({from: tokenHolder1});
            assert.fail('should have thrown before');
        } catch (e) {
            assertJump(e);
        }
    });

    it.skip('should payout the unclaimed token to owner account.', async () => {
        // @FIXME:

        // @TODO: bignumber
        // console.log(await web3.eth.getBalance(owner).toNumber());

        // @TODO: bignumber
        let contractBalance = Math.ceil(web3.fromWei(web3.eth.getBalance(icoTokenInstance.address)).toNumber());
        console.log(contractBalance);

        // const balanceTokenInstance1   = await icoTokenInstance.balanceOf(icoTokenInstance.address);
        // const balanceBeneficiary1     = await icoTokenInstance.balanceOf(owner);
        // console.log(balanceTokenInstance1.toNumber(), balanceBeneficiary1.toNumber());

        await icoTokenInstance.requestUnclaimed({from: owner});

        // @TODO: bignumber
        contractBalance = Math.ceil(web3.fromWei(web3.eth.getBalance(icoTokenInstance.address)).toNumber());
        console.log(contractBalance);

        // @TODO: bignumber
        // console.log(await web3.eth.getBalance(owner).toNumber());
        // console.log(await web3.eth.getBalance(contract).toNumber());

        // const balanceTokenInstance2   = await icoTokenInstance.balanceOf(icoTokenInstance.address);
        // const balanceBeneficiary2     = await icoTokenInstance.balanceOf(owner);
        // console.log(balanceTokenInstance2.toNumber(), balanceBeneficiary2.toNumber());
    });

    /**
     * [ Dividend cycle is over ]
     */

    it('should turn the time 20 days forward', async () => {
        console.log('[ Dividend cycle is over ]');
        await waitNDays(20);
        // @TODO: test the timestamps
    });

    // it('', async () => {

    // });
});
